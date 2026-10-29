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

function SalesChart({ data = [] }) {
  return (
    <section className="loomzi-chart-card">
      <div className="loomzi-section-heading">
        <div>
          <h2>Sales Overview</h2>
          <p>Monthly sales performance (actual orders)</p>
        </div>
      </div>

      <div className="loomzi-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
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
