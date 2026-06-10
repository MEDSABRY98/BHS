import NoData from '@/components/01-Unified/NoDataTab';

interface WaterDailyTabProps {
  dailyData: any[];
}

export default function WaterDailyTab({ dailyData }: WaterDailyTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Daily Output</h2>

      {dailyData.length === 0 ? (
        <NoData title="NO DAILY SUMMARY" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <th className="border border-gray-300 px-4 py-3 text-center font-bold sticky left-0 bg-blue-600 z-10">
                  Date
                </th>
                {(() => {
                  const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();
                  return productNames.map(product => (
                    <th key={product} className="border border-gray-300 px-4 py-3 text-center font-bold min-w-[120px]">
                      {product}
                    </th>
                  ));
                })()}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const dateMap = new Map<string, Map<string, number>>();

                dailyData.forEach(entry => {
                  if (!dateMap.has(entry.date)) {
                    dateMap.set(entry.date, new Map());
                  }
                  const productMap = dateMap.get(entry.date)!;
                  const currentQty = productMap.get(entry.itemName) || 0;
                  productMap.set(entry.itemName, currentQty + entry.quantity);
                });

                const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
                  return new Date(b).getTime() - new Date(a).getTime();
                });

                const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();

                return sortedDates.map((date, idx) => {
                  const productMap = dateMap.get(date)!;
                  return (
                    <tr key={date} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-3 font-bold text-gray-800 text-center sticky left-0 bg-inherit z-10">
                        {date}
                      </td>
                      {productNames.map(product => {
                        const qty = productMap.get(product) || 0;
                        return (
                          <td
                            key={product}
                            className={`border border-gray-300 px-4 py-3 text-center font-mono ${qty > 0 ? 'text-gray-800 font-bold' : 'text-gray-400'
                              }`}
                          >
                            {qty > 0 ? qty.toLocaleString() : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-300 px-4 py-3 text-gray-900 sticky left-0 bg-gray-100 z-10">
                  TOTAL
                </td>
                {(() => {
                  const productNames = Array.from(new Set(dailyData.map(d => d.itemName))).sort();
                  return productNames.map(product => {
                    const total = dailyData
                      .filter(d => d.itemName === product)
                      .reduce((sum, d) => sum + d.quantity, 0);
                    return (
                      <td key={product} className="border border-gray-300 px-4 py-3 text-center font-mono text-blue-700 font-bold">
                        {total.toLocaleString()}
                      </td>
                    );
                  });
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
