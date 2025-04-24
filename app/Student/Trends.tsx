// components/TransactionCharts.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import axios from "axios";
import { Chart } from "react-chartjs-2";
import { useAuth } from "../AuthContext";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
);

type Transaction = {
  transaction_date: string;
  transaction_mode: string;
  transaction_id: string;
  Total_Amount: number;
  Location: string;
};

function toChicagoDateString(dateStr: string): string {
  const chicagoDate = new Date(
    new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  return chicagoDate.toLocaleDateString("en-US", { timeZone: "America/Chicago" });
}

function toChicagoMonthString(dateStr: string): string {
  const chicagoDate = new Date(
    new Date(dateStr).toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  return `${chicagoDate.getFullYear()}-${String(chicagoDate.getMonth() + 1).padStart(2, "0")}`;
}

export default function TransactionCharts() {
  const { username } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState({
    meal_swipes_left: 0,
    flex_dollars_left: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [txRes, balanceRes] = await Promise.all([
          axios.get(`http://127.0.0.1:8081/transactions/${username}`),
          axios.get(`http://127.0.0.1:8081/swipe_balance/${username}`),
        ]);
        setTransactions(txRes.data);
        setBalances(balanceRes.data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [username]);

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;

  const groupedByMonth: Record<string, { swipes: number; flex: number }> = {};
  const groupedByDate: Record<string, { swipes: number; flex: number }> = {};
  const itemCounts: Record<string, number> = {};

  for (const t of transactions) {
    const day = toChicagoDateString(t.transaction_date);
    const month = toChicagoMonthString(t.transaction_date);

    if (!groupedByMonth[month]) groupedByMonth[month] = { swipes: 0, flex: 0 };
    if (!groupedByDate[day]) groupedByDate[day] = { swipes: 0, flex: 0 };

    if (t.transaction_mode === "Meal Swipes") {
      groupedByMonth[month].swipes += 1;
      groupedByDate[day].swipes += 1;
    }
    if (t.transaction_mode === "Flex Dollars") {
      groupedByMonth[month].flex += t.Total_Amount;
      groupedByDate[day].flex += t.Total_Amount;
    }

    if (t.Location === "Chick-fil-A") {
      itemCounts[t.transaction_id] = (itemCounts[t.transaction_id] || 0) + 1;
    }
  }

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const lastMonth = sortedMonths.at(-1);
  const lastMonthSwipes = lastMonth ? groupedByMonth[lastMonth].swipes : 0;
  const lastMonthFlex = lastMonth ? groupedByMonth[lastMonth].flex : 0;
  const mostUsedItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  const swipeData = sortedDates.map((d) => groupedByDate[d].swipes);
  const flexData = sortedDates.map((d) => groupedByDate[d].flex);
  const swipeDataMonthly = sortedMonths.map((d) => groupedByMonth[d].swipes);
  const flexDataMonthly = sortedMonths.map((d) => groupedByMonth[d].flex);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.cardRow}>
        <View style={styles.card2}><Text style={styles.cardTitle}>Meal Swipes to Enjoy</Text><Text style={styles.cardValue}>{balances.meal_swipes_left}</Text></View>
        
        <View style={styles.card3}><Text style={styles.cardTitle}>Most Ordered Chick-fil-A Item</Text><Text style={styles.cardValue}>Chick-fil-A® Classic Sandwich</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Meal Swipes Spent This Month</Text><Text style={styles.cardValue}>{lastMonthSwipes}</Text></View>
        <View style={styles.card2}><Text style={styles.cardTitle}>Flex Dollars to Enjoy</Text><Text style={styles.cardValue}>${balances.flex_dollars_left.toFixed(2)}</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Flex Dollars Spent This Month</Text><Text style={styles.cardValue}>${lastMonthFlex.toFixed(2)}</Text></View>
        
      </View>

      <ScrollView horizontal contentContainerStyle={styles.chartContainer}>
        <View style={{ width: 793 }}>
          <Chart
            type="bar"
            data={{
              labels: sortedDates,
              datasets: [
                {
                  type: "bar",
                  label: "Meal Swipes",
                  data: swipeData,
                  backgroundColor: "rgba(165, 42, 42, 0.6)",
                },
                {
                  type: "line",
                  label: "Flex Dollars",
                  data: flexData,
                  borderColor: "#005fa8",
                  backgroundColor: "rgba(0, 95, 168, 0.2)",
                  fill: true,
                  tension: 0.3,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: {
                  display: true,
                  text: "Daily Swipes (Bar) vs Flex Dollars (Line) - Chicago Time",
                  
                },
              },
            }}
          />
        </View>

        <View style={{ width: 793 }}>
          <Chart
            type="bar"
            data={{
              labels: sortedMonths,
              datasets: [
                {
                  label: "Meal Swipes",
                  data: swipeDataMonthly,
                  backgroundColor: "rgba(165, 42, 42, 0.6)",
                },
                {
                  label: "Flex Dollars",
                  data: flexDataMonthly,
                  backgroundColor: "rgba(0, 95, 168, 0.6)",
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: {
                  display: true,
                  text: "Monthly Meal Swipes and Flex Dollars (Bar) - Chicago Time",
                },
              },
            }}
          />
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff" },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 30,
  },
  card: {
    backgroundColor: 'rgba(255, 51, 0, 0.21)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: "30%",
    minWidth: 200,
    alignItems: "center",
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 8,
    fontWeight: "600",
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
  },
  chartContainer: {
    gap: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 50,
  },

  card2: 
  {
    backgroundColor: "rgba(0, 255, 81, 0.2)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: "30%",
    minWidth: 200,
    alignItems: "center",
    elevation: 3,
  },

  card3:
    {
        backgroundColor: "rgba(0, 157, 255, 0.19)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        width: "30%",
        minWidth: 200,
        alignItems: "center",
        elevation: 3,
    },
});
