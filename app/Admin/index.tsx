// app/Admin/AdminDashboard.tsx
import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  View,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

// point axios at your FastAPI
axios.defaults.baseURL = "http://127.0.0.1:8081";

// helpers for Chicago time formatting

export default function AdminDashboard() {
  const navigation = useNavigation();

  // summary stats
  const [studentCount, setStudentCount] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [income, setIncome] = useState(0);
  const [overallSwipes, setOverallSwipes] = useState(0);
  const [overallIncome, setOverallIncome] = useState(0);

  // chart data
  const [dailyLabels, setDailyLabels] = useState<string[]>([]);
  const [dailySwipes, setDailySwipes] = useState<number[]>([]);
  const [dailyIncome, setDailyIncome] = useState<number[]>([]);
  const [monthlyLabels, setMonthlyLabels] = useState<string[]>([]);
  const [monthlySwipes, setMonthlySwipes] = useState<number[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // basic counts
        const [studRes, empRes] = await Promise.all([
          axios.get("/student_users/"),
          axios.get("/users/"),
        ]);
        setStudentCount(Array.isArray(studRes.data) ? studRes.data.length : 0);
        setEmployeeCount(Array.isArray(empRes.data) ? empRes.data.length : 0);

        // today's swipes & revenue
        const today = new Date().toLocaleDateString("sv-SE"); // ✅ 'YYYY-MM-DD' in local time

        const txRes = await axios.get(`/total_swipes/?date=${today}`);
        const todayTxs = Array.isArray(txRes.data) ? txRes.data : [];

        // meal swipe count
        const mealSwipes = todayTxs.filter(
          (tx: any) => tx.mode === "Meal Swipes"
        );
        setSwipeCount(mealSwipes.length);

        // revenue today (exclude meal swipes)
        const revenueToday = todayTxs
          .filter((tx: any) => tx.mode !== "Meal Swipes")
          .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
        setIncome(revenueToday);

        // overall totals & prepare for charts
        const allRes = await axios.get("/Transactions/");
        const allTxs = Array.isArray(allRes.data) ? allRes.data : [];

        // overall swipe count
        const totalMeal = allTxs.filter(
          (tx: any) => tx.transaction_mode === "Meal Swipes"
        );
        setOverallSwipes(totalMeal.length);

        // overall revenue (exclude meal swipes)
        const revenueAllTime = allTxs
          .filter((tx: any) => tx.transaction_mode !== "Meal Swipes")
          .reduce((sum: number, tx: any) => sum + (tx.Total_Amount || 0), 0);
        setOverallIncome(revenueAllTime);

        // build daily grouping
        const dayMap: Record<string, { swipes: number; income: number }> = {};
        allTxs.forEach((tx: any) => {
          const d = new Date(tx.transaction_date).toLocaleDateString("sv-SE");

          if (!dayMap[d]) dayMap[d] = { swipes: 0, income: 0 };
          if (tx.transaction_mode === "Meal Swipes") dayMap[d].swipes += 1;
          else dayMap[d].income += tx.Total_Amount || 0;
        });
        const days = Object.keys(dayMap).sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );
        setDailyLabels(days);
        setDailySwipes(days.map((d) => dayMap[d].swipes));
        setDailyIncome(days.map((d) => dayMap[d].income));

        // build monthly grouping
        const monthMap: Record<string, { swipes: number; income: number }> = {};
        allTxs.forEach((tx: any) => {
          const dt = new Date(tx.transaction_date);
          const m = dt.toLocaleDateString("sv-SE").slice(0, 7); // 'YYYY-MM'

          if (!monthMap[m]) monthMap[m] = { swipes: 0, income: 0 };
          if (tx.transaction_mode === "Meal Swipes") monthMap[m].swipes += 1;
          else monthMap[m].income += tx.Total_Amount || 0;
        });
        const months = Object.keys(monthMap).sort();
        setMonthlyLabels(months);
        setMonthlySwipes(months.map((m) => monthMap[m].swipes));
        setMonthlyIncome(months.map((m) => monthMap[m].income));
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Could not load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  const cards = [
    {
      label: "Total Students",
      value: studentCount,
      nav: "Admin_users/students",
    },
    {
      label: "Total Employees",
      value: employeeCount,
      nav: "Admin_users/employees",
    },
    { label: "Swipes Today", value: swipeCount, nav: "Transactions/Meal_flex" },
    {
      label: "Revenue Today",
      value: `$${income.toFixed(2)}`,
      nav: "Transactions/cash_card",
    },
    {
      label: "Overall Swipes",
      value: overallSwipes,
      nav: "Transactions/Meal_flex",
    },
    {
      label: "Overall Revenue",
      value: `$${overallIncome.toFixed(2)}`,
      nav: "Transactions/cash_card",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.mainScroll}>
        <Text style={styles.heading}>Admin Dashboard</Text>
        <Text style={styles.subheading}>
          As of{" "}
          {new Date().toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </Text>

        {/* Cards */}
        <View style={styles.cardsContainer}>
          {cards.map((card, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.card}
              onPress={() => navigation.navigate(card.nav as never)}
            >
              <Text style={styles.cardText}>{card.label}</Text>
              <Text style={styles.cardCount}>{card.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Charts Row 1 */}
        <View style={styles.chartsRow}>
          <View style={styles.chartWrapper}>
            <Chart
              type="bar"
              data={{
                labels: dailyLabels,
                datasets: [
                  {
                    type: "bar" as const,
                    label: "Meal Swipes",
                    data: dailySwipes,
                    backgroundColor: "rgba(165,42,42,0.6)",
                  },
                  {
                    type: "line" as const,
                    label: "Revenue ($)",
                    data: dailyIncome,
                    borderColor: "#005fa8",
                    backgroundColor: "rgba(0,95,168,0.2)",
                    fill: false,
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
                    text: "Daily Meal Swipes vs Revenue",
                  },
                },
              }}
            />
          </View>

          <View style={styles.chartWrapper}>
            <Chart
              type="bar"
              data={{
                labels: monthlyLabels,
                datasets: [
                  {
                    label: "Meal Swipes",
                    data: monthlySwipes,
                    backgroundColor: "rgba(165,42,42,0.6)",
                  },
                  {
                    label: "Revenue ($)",
                    data: monthlyIncome,
                    backgroundColor: "rgba(0,95,168,0.6)",
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "top" },
                  title: {
                    display: true,
                    text: "Monthly Meal Swipes & Revenue",
                  },
                },
              }}
            />
          </View>
        </View>

        {/* Charts Row 2 */}
        <View style={styles.chartsRow}>
          <View style={styles.chartWrapper}>
            <Chart
              type="bar"
              data={{
                labels: ["Students", "Employees"],
                datasets: [
                  {
                    label: "Count",
                    data: [studentCount, employeeCount],
                    backgroundColor: [
                      "rgba(165,42,42,0.6)",
                      "rgba(0,95,168,0.6)",
                    ],
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: "Total Students vs Employees" },
                },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </View>

          <View style={styles.chartWrapper}>
            <Chart
              type="bar"
              data={{
                labels: ["Total Swipes", "Total Revenue"],
                datasets: [
                  {
                    label: "Totals",
                    data: [overallSwipes, overallIncome],
                    backgroundColor: [
                      "rgba(165,42,42,0.6)",
                      "rgba(0,95,168,0.6)",
                    ],
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: "Overall Swipes vs Revenue" },
                },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  mainScroll: {
    paddingVertical: 20,
    paddingHorizontal: 30,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    marginBottom: 20,
    color: "#555",
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  card: {
    width: "28%",
    height: 120,
    backgroundColor: "#FFFFFF",
    borderColor: "brown",
    borderWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  cardText: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  cardCount: {
    fontSize: 32,
    fontWeight: "bold",
  },
  chartsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  chartWrapper: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    elevation: 2,
  },
});
