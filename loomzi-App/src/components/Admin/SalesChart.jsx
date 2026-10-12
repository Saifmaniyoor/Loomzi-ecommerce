//CSS file location - admin layout -- admin layout.css

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const chartData = [
  { month: "Jan", sales: 4500, orders: 45 },
  { month: "Feb", sales: 6200, orders: 62 },
  { month: "Mar", sales: 5800, orders: 58 },
  { month: "Apr", sales: 8500, orders: 85 },
  { month: "May", sales: 7200, orders: 72 },
  { month: "Jun", sales: 10500, orders: 105 },
  { month: "Jul", sales: 9200, orders: 92 },
  { month: "Aug", sales: 12800, orders: 128 },
  { month: "Sep", sales: 11500, orders: 115 },
  { month: "Oct", sales: 14285, orders: 142 },
];

function SalesChart() {
  return (
    <section className="loomzi-chart-card">
      <div className="loomzi-section-heading">
        <div>
          <h2>Sales Overview</h2>
          <p>Monthly sales performance (sample data)</p>
        </div>
      </div>

      <div className="loomzi-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#eceef2"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₹${value / 1000}k`}
            />

            <Tooltip
              formatter={(value) => [
                `₹${Number(value).toLocaleString("en-IN")}`,
                "Sales",
              ]}
            />

            <Legend />

            <Line
              type="monotone"
              dataKey="sales"
              name="Sales (₹)"
              stroke="#a85c13"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default SalesChart;
