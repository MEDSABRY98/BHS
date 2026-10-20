// "Send now" builds the report and emails it inside a server action: give it up to 60 seconds.
export const maxDuration = 60;

export default function ScheduledReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
