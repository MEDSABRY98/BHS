"use client";
import React, { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { bhs_supabase, fetchAllData, getAllCustomerEmails, getLuluEmails } from "@/lib/supabase";
import { buildCustomerEmailMap, getCustomerEmail } from "@/lib/customerEmailLookup";
import Sidebar, { CUSTOMERS_DISCOUNTS_TAB_IDS } from "./Utils/Sidebar";
import { getAllowedModuleTabIds, getCurrentUserFromStorage } from '@/app/AdminControl/AdminControlTab/AdminControlTab';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import ConfirmModal from "./ConfirmModal";
import { toast, NotificationContainer } from "@/app/Components/Notification";
import CustomersList from "./CustomersList/CustomersList";
import AddDiscount from "./AddDiscount/AddDiscount";
import CustomerDetails from "./CustomerDetails/CustomerDetails";
import MonthsOverview from "./MonthsOverview/MonthsOverview";
import Statistics from "./Statistics/Statistics";
import DiscountValues from "./Values/DiscountValues";
import {
  buildMonthGroups,
  splitMonthGroups,
  type MonthGroup,
} from "./Utils/settlementUtils";
import { autoSettleClearedMonths } from "./Utils/AutoSettleClearedMonths";
import { useCustomersDiscountsTabAudit } from '@/app/Audit/Model/CustomersDiscountsTabAudit';

export type { MonthGroup } from "./Utils/settlementUtils";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
  settlementType: string;
};

type Settlement = {
  id: string;
  customerId: string;
  month: number;
  year: number;
  status: string; // "Pending" or "Settled"
  notes: string;
};

export type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  customerTag: string;
  discounts: Discount[];
};

type AllCustomerItem = {
  id: string;
  name: string;
};

const TAX_REBATE_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isEligiblePendingMonth(month: number, year: number, currentYear: number, currentMonth: number) {
  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
}

function buildTaxRebateEmlContent(input: {
  tag: string;
  sections: { customerId: string; customerName: string; periods: { month: number; year: number }[] }[];
  toEmails: string[];
  fallbackCustomerName?: string;
}): { emlContent: string; fileLabel: string } | null {
  const { tag, sections, toEmails, fallbackCustomerName } = input;
  if (sections.length === 0 || toEmails.length === 0) return null;

  const subject =
    "Request for Outstanding Tax Rebate Invoices - Al Marai Al Arabia Trading Sole Proprietorship L.L.C";

  const customersHtml = sections
    .map((c) => {
      const monthsHtml = c.periods
        .map(
          (p) =>
            `    <li style="margin-bottom: 4px;">${TAX_REBATE_MONTH_NAMES[p.month - 1]} ${p.year}</li>`
        )
        .join("\n");
      return `
  <p style="margin: 16px 0 6px;"><strong>${c.customerName}</strong></p>
  <ul style="font-size: 15px; color: #dc2626; font-weight: bold; margin: 0 0 0 10px; padding-left: 20px; list-style-type: square;">
${monthsHtml}
  </ul>`;
    })
    .join("\n");

  const intro = tag
    ? `We are writing to kindly request the outstanding <strong>Tax Rebate Invoices</strong> (Discounts) for customers under tag <strong>${tag}</strong> for the following pending periods:`
    : `We are writing to kindly request the outstanding <strong>Tax Rebate Invoices</strong> (Discounts) for the following pending periods for <strong>${fallbackCustomerName || sections[0].customerName}</strong>:`;

  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
  <p>Dear Team,</p>
  <p>We hope this email finds you well.</p>
  <p>${intro}</p>
  ${customersHtml}
  <p>Please share the pending Tax Rebate Invoices at your earliest convenience so we can reconcile and update our accounts.</p>
  <p>Best regards,<br><br>Accounts Department<br>Al Marai Al Arabia Trading Sole Proprietorship L.L.C</p>
</div>
  `.trim();

  const boundary = "----=_NextPart_000_0001_01C2A9A1.12345678";
  const emlLines = [
    `Date: ${new Date().toUTCString()}`,
    `To: ${toEmails.join(", ")}`,
    "From: accounting@marae.ae",
    "Subject: " + subject,
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    "--" + boundary + "--",
  ];

  const fileLabel = tag
    ? `Tag_${tag.replace(/[^a-zA-Z0-9\u0600-\u06FF\-_]/g, "_")}`
    : (fallbackCustomerName || sections[0].customerName).replace(
        /[^a-zA-Z0-9\u0600-\u06FF]/g,
        "_"
      );

  return { emlContent: emlLines.join("\r\n"), fileLabel };
}

function collectTaxRebateGroups(list: CustomerView[]): { tag: string; group: CustomerView[] }[] {
  const seenTags = new Set<string>();
  const groups: { tag: string; group: CustomerView[] }[] = [];

  for (const customer of list) {
    const tag = (customer.customerTag || "").trim();
    const isLulu = tag.toUpperCase().includes('LULU');

    if (tag && !isLulu) {
      if (seenTags.has(tag)) continue;
      seenTags.add(tag);
      groups.push({
        tag,
        group: list.filter((c) => (c.customerTag || "").trim() === tag),
      });
    } else {
      groups.push({ tag, group: [customer] });
    }
  }

  return groups;
}

export default function CustomerDiscountsPage() {
  // Navigation State
  const [currentView, setCurrentView] = useState<"grid" | "add" | "details" | "months" | "stats" | "values">("grid");
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  
  // Data State
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Details View State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerView | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "pending" | "semi" | "settled">("details");
  useCustomersDiscountsTabAudit(currentView, currentView === 'details' ? activeTab : undefined);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  
  // Add Form State
  const [allCustomers, setAllCustomers] = useState<AllCustomerItem[]>([]);
  const [filteredAllCustomers, setFilteredAllCustomers] = useState<AllCustomerItem[]>([]);
  const [loadingAllCustomers, setLoadingAllCustomers] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  
  // Sidebar UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [autoSettling, setAutoSettling] = useState(false);
  const [monthsOverviewRefreshKey, setMonthsOverviewRefreshKey] = useState(0);
  
  const [selectedAddCustomerId, setSelectedAddCustomerId] = useState<string>("");
  const [discountName, setDiscountName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("fixed_amount");
  const [discountValue, setDiscountValue] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [customersWithEmails, setCustomersWithEmails] = useState<Map<string, string>>(new Map());
  const [downloadingEmailsZip, setDownloadingEmailsZip] = useState(false);

  // Edit State
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [editDiscountName, setEditDiscountName] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percentage" | "fixed_amount">("fixed_amount");
  const [editDiscountValue, setEditDiscountValue] = useState("");

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const openConfirm = (options: { title: string; message: string; onConfirm: () => void; confirmText?: string; cancelText?: string; isDestructive?: boolean }) => {
    setConfirmModal({ ...options, isOpen: true });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    fetchCustomersAndDiscounts();
  }, []);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const allowed = getAllowedModuleTabIds(currentUser, 'customers-discounts', CUSTOMERS_DISCOUNTS_TAB_IDS);
    setCurrentView((prev) => {
      const effective = prev === 'details' ? 'grid' : prev;
      if (allowed.includes(effective)) return prev;
      return (allowed[0] as typeof prev) || 'grid';
    });
  }, [currentUser]);

  // Filter customers in Grid view
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.customerName.toLowerCase().includes(lowerQ) || 
          c.customerId.toLowerCase().includes(lowerQ)
        )
      );
    }
  }, [searchQuery, customers]);

  // Load all customers for Add form when view is "add"
  useEffect(() => {
    if (currentView === "add" && allCustomers.length === 0) {
      fetchAllCustomersForAdd();
    }
  }, [currentView]);

  // Filter all customers for Add form dropdown
  useEffect(() => {
    if (addSearch.trim() === "") {
      setFilteredAllCustomers(allCustomers.slice(0, 50));
    } else {
      const lowerSearch = addSearch.toLowerCase();
      setFilteredAllCustomers(
        allCustomers.filter(c => c.name.toLowerCase().includes(lowerSearch)).slice(0, 50)
      );
    }
  }, [addSearch, allCustomers]);

  const fetchAllCustomersForAdd = async () => {
    try {
      setLoadingAllCustomers(true);
      const data = await fetchAllData(() =>
        bhs_supabase.from("bhs_CUSTOMERS").select('"CUSTOMER ID", "CUSTOMER MAIN NAME"')
      );
      
      const uniqueMap = new Map<string, AllCustomerItem>();

      data.forEach((d: any) => {
        const id = d["CUSTOMER ID"]?.toString().trim();
        const name = d["CUSTOMER MAIN NAME"]?.toString().trim();
        if (id && name && !uniqueMap.has(name)) {
          uniqueMap.set(name, { id, name });
        }
      });
      
      const mapped: AllCustomerItem[] = Array.from(uniqueMap.values());
      mapped.sort((a, b) => a.name.localeCompare(b.name));
        
      setAllCustomers(mapped);
      setFilteredAllCustomers(mapped.slice(0, 50));
    } catch (err) {
      console.error("Error fetching all customers:", err);
    } finally {
      setLoadingAllCustomers(false);
    }
  };

  const downloadTaxRebateEml = async (customerId: string, customerName: string) => {
    try {
      const clicked = customers.find((c) => c.customerId === customerId);
      const tag = (clicked?.customerTag || "").trim();
      const isLulu = tag.toUpperCase().includes('LULU');

      const group = (tag && !isLulu)
        ? customers.filter((c) => (c.customerTag || "").trim() === tag)
        : [
            {
              customerId,
              customerName,
              city: clicked?.city || "",
              customerTag: tag,
              discounts: clicked?.discounts || [],
            },
          ];

      const groupIds = group.map((c) => c.customerId);
      const { data: settlementsData, error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .select("*")
        .in("CUSTOMER_ID", groupIds)
        .eq("STATUS", "Pending");

      if (error) throw error;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const pendingByCustomer = new Map<string, { month: number; year: number }[]>();
      (settlementsData || []).forEach((s: any) => {
        if (!isEligiblePendingMonth(s.MONTH, s.YEAR, currentYear, currentMonth)) return;
        const cId = String(s.CUSTOMER_ID || "").trim();
        if (!cId) return;
        const list = pendingByCustomer.get(cId) || [];
        const key = `${s.MONTH}-${s.YEAR}`;
        if (!list.some((p) => `${p.month}-${p.year}` === key)) {
          list.push({ month: s.MONTH, year: s.YEAR });
          pendingByCustomer.set(cId, list);
        }
      });

      const sections = group
        .map((c) => {
          const periods = (pendingByCustomer.get(c.customerId) || []).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
          return { customerId: c.customerId, customerName: c.customerName, periods };
        })
        .filter((c) => c.periods.length > 0);

      if (sections.length === 0) {
        toast.warning("No outstanding pending months before the current month.");
        return;
      }

      const toEmails = Array.from(
        new Set(
          sections
            .map((c) => getCustomerEmail(customersWithEmails, c.customerId, c.customerName))
            .filter(Boolean)
        )
      );

      if (toEmails.length === 0) {
        toast.warning("No email found for the selected customer(s).");
        return;
      }

      const built = buildTaxRebateEmlContent({
        tag,
        sections,
        toEmails,
        fallbackCustomerName: customerName,
      });
      if (!built) return;

      const blob = new Blob([built.emlContent], { type: "message/rfc822" });
      const { saveTrackedAs } = await import("@/app/Audit/Utils/TrackedDownload");
      saveTrackedAs(blob, `Tax_Rebate_Request_${built.fileLabel}.eml`);
      toast.success(
        tag
          ? `Email draft downloaded for tag "${tag}" (${sections.length} customers).`
          : "Email draft downloaded successfully!"
      );
    } catch (err) {
      console.error("Error generating EML:", err);
      toast.error("Failed to generate EML file.");
    }
  };

  const downloadAllTaxRebateEmlsZip = async () => {
    if (customers.length === 0 || downloadingEmailsZip) return;

    try {
      setDownloadingEmailsZip(true);
      toast.loading("Preparing email drafts ZIP...", { id: "tax-rebate-zip" });

      const allIds = customers.map((c) => c.customerId);
      const { data: settlementsData, error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .select("*")
        .in("CUSTOMER_ID", allIds)
        .eq("STATUS", "Pending");

      if (error) throw error;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const pendingByCustomer = new Map<string, { month: number; year: number }[]>();
      (settlementsData || []).forEach((s: any) => {
        if (!isEligiblePendingMonth(s.MONTH, s.YEAR, currentYear, currentMonth)) return;
        const cId = String(s.CUSTOMER_ID || "").trim();
        if (!cId) return;
        const list = pendingByCustomer.get(cId) || [];
        const key = `${s.MONTH}-${s.YEAR}`;
        if (!list.some((p) => `${p.month}-${p.year}` === key)) {
          list.push({ month: s.MONTH, year: s.YEAR });
          pendingByCustomer.set(cId, list);
        }
      });

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Set<string>();
      let count = 0;

      for (const { tag, group } of collectTaxRebateGroups(customers)) {
        const sections = group
          .map((c) => {
            const periods = (pendingByCustomer.get(c.customerId) || []).sort((a, b) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.month - b.month;
            });
            return { customerId: c.customerId, customerName: c.customerName, periods };
          })
          .filter((c) => c.periods.length > 0);

        if (sections.length === 0) continue;

        const toEmails = Array.from(
          new Set(
            sections
              .map((c) => getCustomerEmail(customersWithEmails, c.customerId, c.customerName))
              .filter(Boolean)
          )
        );
        if (toEmails.length === 0) continue;

        const built = buildTaxRebateEmlContent({
          tag,
          sections,
          toEmails,
          fallbackCustomerName: group[0]?.customerName,
        });
        if (!built) continue;

        let fileName = `Tax_Rebate_Request_${built.fileLabel}.eml`;
        if (usedNames.has(fileName)) {
          fileName = `Tax_Rebate_Request_${built.fileLabel}_${count + 1}.eml`;
        }
        usedNames.add(fileName);
        zip.file(fileName, built.emlContent);
        count++;
      }

      if (count === 0) {
        toast.dismiss("tax-rebate-zip");
        toast.warning("No email drafts to download (no pending months or emails).");
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const { saveTrackedAs } = await import("@/app/Audit/Utils/TrackedDownload");
      saveTrackedAs(
        content,
        `Tax_Rebate_Emails_${new Date().toISOString().split("T")[0]}.zip`
      );
      toast.dismiss("tax-rebate-zip");
      toast.success(`Downloaded ZIP with ${count} email draft(s).`);
    } catch (err) {
      console.error("Error generating emails ZIP:", err);
      toast.dismiss("tax-rebate-zip");
      toast.error("Failed to generate emails ZIP.");
    } finally {
      setDownloadingEmailsZip(false);
    }
  };

  const fetchCustomersAndDiscounts = async () => {
    try {
      setLoading(true);

      const [emailsData, luluEmailsData, discountsData, customersData] = await Promise.all([
        getAllCustomerEmails().catch((err) => {
          console.error("Error loading customer emails:", err);
          return [];
        }),
        getLuluEmails().catch((err) => {
          console.error("Error loading lulu emails:", err);
          return [];
        }),
        fetchAllData(() => bhs_supabase.from("web_CUSTOMERS_DISCOUNTS").select("*")),
        fetchAllData(() =>
          bhs_supabase
            .from("bhs_CUSTOMERS")
            .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "CUSTOMER TAG"')
        ),
      ]);

      const customerRows = customersData.map((row: any) => ({
        id: row["CUSTOMER ID"]?.toString().trim() || "",
        name: row["CUSTOMER MAIN NAME"]?.toString().trim() || "",
      })).filter((row) => row.id);

      const allEmails = [...(emailsData || [])];
      
      if (luluEmailsData) {
        luluEmailsData.forEach((lulu: any) => {
           const combinedEmail = [lulu.to, lulu.cc].filter(Boolean).join(", ");
           if (combinedEmail && lulu.customerId) {
             allEmails.push({ customerId: lulu.customerId, email: combinedEmail });
           }
        });
      }

      setCustomersWithEmails(buildCustomerEmailMap(allEmails, customerRows));

      // Group discounts by customer ID
      const discountsByCustomer: Record<string, Discount[]> = {};
      discountsData.forEach((d: any) => {
        const cId = d.CUSTOMER_ID;
        if (!discountsByCustomer[cId]) discountsByCustomer[cId] = [];
        discountsByCustomer[cId].push({
          id: d.ID,
          customerId: cId,
          name: d.DISCOUNT_NAME,
          type: d.DISCOUNT_TYPE,
          value: Number(d.DISCOUNT_VALUE) || 0,
          settlementType: d.SETTLEMENT_TYPE || "monthly",
        });
      });

      const customerIds = Object.keys(discountsByCustomer);

      if (customerIds.length === 0) {
        setCustomers([]);
        setFilteredCustomers([]);
        return;
      }

      const customerNameMap = new Map<string, string>();
      const customerCityMap = new Map<string, string>();
      const customerTagMap = new Map<string, string>();

      customersData.forEach((row: any) => {
        const id = row["CUSTOMER ID"]?.toString().trim();
        const name = row["CUSTOMER MAIN NAME"]?.toString().trim();
        const city = row["CUSTOMER CITY"]?.toString().trim();
        const tag = row["CUSTOMER TAG"]?.toString().trim() || "";
        if (id) {
          if (name) customerNameMap.set(id, name);
          if (city) customerCityMap.set(id, city);
          if (tag) customerTagMap.set(id, tag);
        }
      });

      const finalCustomers: CustomerView[] = customerIds.map((cId) => ({
        customerId: cId,
        customerName: customerNameMap.get(cId) || cId,
        city: customerCityMap.get(cId) || "Unknown",
        customerTag: customerTagMap.get(cId) || "",
        discounts: discountsByCustomer[cId],
      }));

      // Sort alphabetically
      finalCustomers.sort((a, b) => a.customerName.localeCompare(b.customerName));
      setCustomers(finalCustomers);
      
      // If a customer was already selected, update it
      if (selectedCustomer) {
        const updatedCustomer = finalCustomers.find(c => c.customerId === selectedCustomer.customerId);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        } else {
          // Customer has no discounts left
          setSelectedCustomer(null);
          setCurrentView("grid");
        }
      }
    } catch (error) {
      console.error("Error fetching customers and discounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (
    customer: CustomerView,
    initialTab: "details" | "pending" | "semi" | "settled" = "details"
  ) => {
    setSelectedCustomer(customer);
    setActiveTab(initialTab);
    setCurrentView("details");
    await loadSettlements(customer.customerId);
  };

  const loadSettlements = async (customerId: string) => {
    try {
      setLoadingSettlements(true);
      const data = await fetchAllData(() =>
        bhs_supabase
          .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
          .select("*")
          .eq("CUSTOMER_ID", customerId)
      );

      const mappedData: Settlement[] = data.map((d: any) => ({
        id: d.ID,
        customerId: d.CUSTOMER_ID,
        month: d.MONTH,
        year: d.YEAR,
        status: d.STATUS,
        notes: d.NOTES,
      }));

      // Sort by year then month
      mappedData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      setSettlements(mappedData);
    } catch (error) {
      console.error("Error loading settlements:", error);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const handleSettle = async (settlementIds: string[]) => {
    try {
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .update({ STATUS: "Settled" })
        .in("ID", settlementIds);

      if (error) throw error;

      // Optimistic update
      setSettlements((prev) =>
        prev.map((s) => (settlementIds.includes(s.id) ? { ...s, status: "Settled" } : s))
      );
    } catch (error) {
      console.error("Error settling month:", error);
      alert("An error occurred during settlement.");
    }
  };

  const handleAutoSettleClearedMonths = async () => {
    if (autoSettling) return;
    try {
      setAutoSettling(true);
      toast.info("Checking past pending months against open balances...");
      const result = await autoSettleClearedMonths();

      if (result.settledCount === 0) {
        toast.info(
          `No cleared months to settle (${result.scannedPending} past pending checked).`,
        );
        return;
      }

      const settledSet = new Set(result.settledIds);
      setSettlements((prev) =>
        prev.map((s) => (settledSet.has(s.id) ? { ...s, status: "Settled" } : s)),
      );
      setMonthsOverviewRefreshKey((key) => key + 1);
      toast.success(
        `Auto-settled ${result.settledCount} settlement(s) across cleared past months.`,
      );
    } catch (error) {
      console.error("Auto-settle cleared months failed:", error);
      toast.error("Failed to auto-settle cleared months.");
    } finally {
      setAutoSettling(false);
    }
  };

  const handleUnsettle = async (settlementIds: string[]) => {
    try {
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .update({ STATUS: "Pending" })
        .in("ID", settlementIds);

      if (error) throw error;

      // Optimistic update
      setSettlements((prev) =>
        prev.map((s) => (settlementIds.includes(s.id) ? { ...s, status: "Pending" } : s))
      );
    } catch (error) {
      console.error("Error unsettling month:", error);
      alert("An error occurred during unsettle action.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!selectedAddCustomerId) {
      setAddError("Please select a customer.");
      return;
    }
    if (!discountName.trim()) {
      setAddError("Please enter a discount/rent name.");
      return;
    }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      setAddError("Please enter a valid positive value.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Fetch the maximum discount ID to generate the next sequential R-XXXX ID
      const { data: maxIdData, error: maxIdError } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .select("ID")
        .order("ID", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxIdError) throw maxIdError;

      let nextNum = 1;
      if (maxIdData && maxIdData.ID) {
        const match = maxIdData.ID.match(/^R-(\d+)$/i);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      const discountId = `R-${String(nextNum).padStart(4, '0')}`;
      
      // Determine the default settlement type based on existing discounts for this customer
      const customerObj = customers.find(c => c.customerId === selectedAddCustomerId);
      const defaultSettlementType = customerObj && customerObj.discounts.length > 0
        ? (customerObj.discounts[0].settlementType || "monthly")
        : "monthly";
      
      // Insert discount
      const { error: discountError } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .insert({
          ID: discountId,
          CUSTOMER_ID: selectedAddCustomerId,
          DISCOUNT_NAME: discountName,
          DISCOUNT_TYPE: discountType,
          DISCOUNT_VALUE: Number(discountValue),
          SETTLEMENT_TYPE: defaultSettlementType,
        });

      if (discountError) throw discountError;

      // Generate 12 months for 2026
      const year = 2026;
      const newSettlements = [];
      for (let month = 1; month <= 12; month++) {
        newSettlements.push({
          ID: `S-${discountId}-${month}`,
          CUSTOMER_ID: selectedAddCustomerId,
          MONTH: month,
          YEAR: year,
          STATUS: "Pending",
          NOTES: "",
        });
      }

      const { error: settlementsError } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .insert(newSettlements);

      if (settlementsError) throw settlementsError;

      // Success
      setDiscountName("");
      setDiscountValue("");
      // Keep selectedAddCustomerId and addSearch so they can add another discount for the same customer easily
      
      await fetchCustomersAndDiscounts();
      
      // Show a quick success alert or just let the empty fields indicate success
      toast.success("Config added successfully!");

    } catch (err: any) {
      console.error("Error saving discount:", err);
      setAddError(err.message || "An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit & Delete handlers
  const handleDeleteDiscount = async (discountId: string) => {
    openConfirm({
      title: "Delete Configuration",
      message: "Are you sure you want to delete this config and all its pending/settled months? This action cannot be undone.",
      confirmText: "Delete",
      isDestructive: true,
      onConfirm: async () => {
        try {
          // Delete settlements first
          await bhs_supabase
            .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
            .delete()
            .like("ID", `S-${discountId}-%`);

          // Delete discount
          await bhs_supabase
            .from("web_CUSTOMERS_DISCOUNTS")
            .delete()
            .eq("ID", discountId);

          await fetchCustomersAndDiscounts();
        } catch (err) {
          console.error("Error deleting discount:", err);
          alert("An error occurred while deleting.");
        }
      }
    });
  };

  const startEditDiscount = (d: Discount) => {
    setEditingDiscountId(d.id);
    setEditDiscountName(d.name);
    setEditDiscountType(d.type as any);
    setEditDiscountValue(d.value.toString());
  };

  const cancelEditDiscount = () => {
    setEditingDiscountId(null);
  };

  const handleUpdateSettlementType = async (customerId: string, newType: "monthly" | "with_payment") => {
    try {
      setIsSubmitting(true);
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .update({
          SETTLEMENT_TYPE: newType
        })
        .eq("CUSTOMER_ID", customerId);

      if (error) throw error;

      toast.success("Settlement mode updated successfully!");
      await fetchCustomersAndDiscounts();
    } catch (err) {
      console.error("Error updating settlement type:", err);
      toast.error("Failed to update settlement mode.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveEditDiscount = async () => {
    if (!editingDiscountId) return;
    if (!editDiscountName.trim() || !editDiscountValue || isNaN(Number(editDiscountValue)) || Number(editDiscountValue) <= 0) {
      alert("Please provide valid inputs.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .update({
          DISCOUNT_NAME: editDiscountName,
          DISCOUNT_TYPE: editDiscountType,
          DISCOUNT_VALUE: Number(editDiscountValue),
        })
        .eq("ID", editingDiscountId);

      if (error) throw error;
      
      setEditingDiscountId(null);
      await fetchCustomersAndDiscounts();
    } catch (err) {
      console.error("Error updating discount:", err);
      alert("Error updating discount.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived filtered settlements up to current month
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const visibleSettlements = settlements.filter((s) => {
    if (s.year < currentYear) return true;
    if (s.year === currentYear && s.month <= currentMonth) return true;
    return false;
  });

  const allMonthGroups = buildMonthGroups(
    visibleSettlements,
    selectedCustomer?.discounts.map((d) => ({ id: d.id, name: d.name })) || []
  );

  const { pending: pendingMonthGroups, semiSettled: semiSettledMonthGroups, settled: settledMonthGroups } =
    splitMonthGroups(allMonthGroups);

  // Format month to English name
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const getMonthName = (m: number) => monthNames[m - 1] || m.toString();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentView={currentView}
        setCurrentView={setCurrentView}
        setSelectedCustomer={setSelectedCustomer}
        currentUser={currentUser}
      />

      {/* Main Workspace Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-gray-50">
        


        {currentView === "grid" && (
          <CustomersList 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            customers={customers}
            filteredCustomers={filteredCustomers}
            handleSelectCustomer={handleSelectCustomer}
            customersWithEmails={customersWithEmails}
            downloadTaxRebateEml={downloadTaxRebateEml}
            downloadAllTaxRebateEmlsZip={downloadAllTaxRebateEmlsZip}
            downloadingEmailsZip={downloadingEmailsZip}
            onAutoSettleClearedMonths={handleAutoSettleClearedMonths}
            autoSettling={autoSettling}
          />
        )}

        {currentView === "add" && (
          <AddDiscount 
            handleAddSubmit={handleAddSubmit}
            addError={addError}
            loadingAllCustomers={loadingAllCustomers}
            addSearch={addSearch}
            setAddSearch={setAddSearch}
            filteredAllCustomers={filteredAllCustomers}
            selectedAddCustomerId={selectedAddCustomerId}
            setSelectedAddCustomerId={setSelectedAddCustomerId}
            discountName={discountName}
            setDiscountName={setDiscountName}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            isSubmitting={isSubmitting}
          />
        )}

        {currentView === "details" && selectedCustomer && (
          <CustomerDetails 
            selectedCustomer={selectedCustomer}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setCurrentView={setCurrentView}
            setSelectedCustomer={setSelectedCustomer}
            pendingMonthGroups={pendingMonthGroups}
            semiSettledMonthGroups={semiSettledMonthGroups}
            settledMonthGroups={settledMonthGroups}
            getMonthName={getMonthName}
            handleSettle={handleSettle}
            handleUnsettle={handleUnsettle}
            openConfirm={openConfirm}
            editingDiscountId={editingDiscountId}
            setEditingDiscountId={setEditingDiscountId}
            editDiscountName={editDiscountName}
            setEditDiscountName={setEditDiscountName}
            editDiscountType={editDiscountType}
            setEditDiscountType={setEditDiscountType}
            editDiscountValue={editDiscountValue}
            setEditDiscountValue={setEditDiscountValue}
            handleUpdateSettlementType={handleUpdateSettlementType}
            saveEditDiscount={saveEditDiscount}
            cancelEditDiscount={cancelEditDiscount}
            handleDeleteDiscount={handleDeleteDiscount}
            isSubmitting={isSubmitting}
            startEditDiscount={startEditDiscount}
            customersWithEmails={customersWithEmails}
            downloadTaxRebateEml={downloadTaxRebateEml}
          />
        )}
        
        {currentView === "months" && (
          <MonthsOverview 
            customers={customers}
            handleSelectCustomer={handleSelectCustomer}
            refreshKey={monthsOverviewRefreshKey}
          />
        )}
        
        {currentView === "stats" && (
          <Statistics customers={customers} />
        )}

        {currentView === "values" && (
          <DiscountValues customers={customers} />
        )}

      </div>

      <ConfirmModal 
        modal={confirmModal}
        closeConfirm={closeConfirm}
      />
      
      {/* Toast Notification */}
      <NotificationContainer />
    </div>
  );
}
