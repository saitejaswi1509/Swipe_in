import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/FontAwesome";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";

import { styles } from "./student_styles/styles";
import { useAuth } from "../AuthContext";
import { router } from "expo-router";

const SCREEN_WIDTH = Dimensions.get("window").width;

function getDallasDateObject(dateStr: string): Date {
  const utcDate = new Date(dateStr);

  // Get timezone offset for America/Chicago at that date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(utcDate).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = parseInt(part.value, 10);
    }
    return acc;
  }, {} as Record<string, number>);

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}


function formatDallasDateTime(dateStr: string): string {
  return getDallasDateObject(dateStr).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "short",
    timeStyle: "short",
    hour12: true,
  });
}

// Chicago–time formatting helpers
function toChicagoYMD(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/Chicago" });
}
function toChicagoYMDfromISO(iso: string) {
  return toChicagoYMD(new Date(iso));
}
const nowChi = new Date(
  new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })
);
const todayYMD = toChicagoYMD(nowChi);
const yesterday = new Date(nowChi);
yesterday.setDate(nowChi.getDate() - 1);
const yesterdayYMD = toChicagoYMD(yesterday);

type Transaction = {
  transaction_date: string;
  transaction_mode: string;
  transaction_id: string;
  Total_Amount: number;
  Location: string;
};

// Helpers for web date‐input to avoid UTC offset
function formatChicagoDateForInput(d: Date): string {
  // "en-CA" gives "YYYY-MM-DD", rendered in America/Chicago zone
  return d.toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}
function parseChicagoInput(val: string): Date {
  const [y, m, day] = val.split("-").map(Number);
  // creates a Date at local midnight of that day
  return new Date(y, m - 1, day);
}

export default function HomePage() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const { firstname, username } = useAuth();

  // ─── Meal Plan state ─────────────────────────────────────────────
  const [plan, setPlan] = useState<string>("");

  // ─── Balances state ───────────────────────────────────────────────
  const [balances, setBalances] = useState<{
    meal_swipes_left: number;
    flex_dollars_left: number;
  }>({ meal_swipes_left: 0, flex_dollars_left: 0 });

  // ─── Date filter state ───────────────────────────────────────────
  const [dateFilter, setDateFilter] = useState<
    "All" | "Today" | "Yesterday" | "Range"
  >("All");
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  // ─── Tab + transaction state ────────────────────────────────────
  const [selectedTab, setSelectedTab] = useState<"swipes" | "flex">("swipes");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Show More / Show Less ───────────────────────────────────────
  const [showAll, setShowAll] = useState(false);

  // ─── Fetch meal plan ─────────────────────────────────────────────
  useEffect(() => {
    axios
      .get<{ meal_plan: string }>(`http://127.0.0.1:8081/meal_plan/${username}`)
      .then((res) => setPlan(res.data.meal_plan))
      .catch((err) => console.error("Plan fetch error:", err));
  }, [username]);

  // ─── Fetch balances ─────────────────────────────────────────────
  useEffect(() => {
    axios
      .get<{ meal_swipes_left: number; flex_dollars_left: number }>(
        `http://127.0.0.1:8081/swipe_balance/${username}`
      )
      .then((res) => setBalances(res.data))
      .catch((err) => console.error("Balance fetch error:", err));
  }, [username]);

  // ─── Fetch transactions ─────────────────────────────────────────
  useEffect(() => {
    axios
      .get<Transaction[]>(`http://127.0.0.1:8081/transactions/${username}`)
      .then((res) => setTransactions(res.data))
      .catch((err) => console.error("Tx fetch error:", err))
      .finally(() => setLoading(false));
  }, [username]);

  // ─── Filter & sort ─────────────────────────────────────────────

  // Helpers to format/parse dates in America/Chicago
  const formatChicagoDateForInput = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const parseChicagoInput = (val: string) => {
    const [y, m, day] = val.split("-").map(Number);
    return new Date(y, m - 1, day);
  };
  // zero-time helper
  const zeroTime = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };

  const filtered = transactions
    .slice()
    .sort(
      (a, b) =>
        getDallasDateObject(b.transaction_date).getTime() -
        getDallasDateObject(a.transaction_date).getTime()
    )
    .filter((tx) => {
      const txDay = zeroTime(getDallasDateObject(tx.transaction_date));

      if (dateFilter === "Today") {
        if (txDay.getTime() !== zeroTime(new Date()).getTime()) return false;
      }
      if (dateFilter === "Yesterday") {
        const y = zeroTime(new Date());
        y.setDate(y.getDate() - 1);
        if (txDay.getTime() !== y.getTime()) return false;
      }
      if (dateFilter === "Range" && dateRange.start && dateRange.end) {
        const s = zeroTime(dateRange.start);
        const e = zeroTime(dateRange.end);
        if (txDay < s || txDay > e) return false;
      }
      return true;
    })
    .filter((tx) =>
      selectedTab === "swipes"
        ? tx.transaction_mode === "Meal Swipes"
        : tx.transaction_mode === "Flex Dollars"
    );

  const firstFive = filtered.slice(0, 5);
  const displayed = showAll ? filtered : firstFive;

  // Native DateTimePicker handler
  const onChangeRange = (which: "start" | "end") => (_: any, picked?: Date) => {
    setShowPicker(null);
    if (picked) setDateRange((r) => ({ ...r, [which]: picked }));
  };
  return (
    <ScrollView ref={scrollRef} showsHorizontalScrollIndicator={false}>
      <View style={localStyles.balanceContainer}>
        <Text style={localStyles.planText}>
          Your Meal Plan: {plan || "Not Available"}
        </Text>

        <View style={localStyles.balanceRow}>
          <Icon name="cutlery" size={20} style={localStyles.balanceIcon} />
          <Text style={localStyles.balanceText}>
            Meal Swipes Left: {balances.meal_swipes_left}
          </Text>
        </View>

        <View style={localStyles.balanceRow}>
          <Icon name="dollar" size={20} style={localStyles.balanceIcon} />
          <Text style={localStyles.balanceText}>
            Flex Dollars Left: ${balances.flex_dollars_left.toFixed(2)}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/Student/meal_upgrade")}
          style={({ hovered, pressed }) => [
            localStyles.upgradeBtn,
            hovered && localStyles.upgradeHover,
            pressed && localStyles.upgradePressed,
          ]}
        >
          <Text style={localStyles.upgradeText}>Upgrade</Text>
        </Pressable>
      </View>

      {/* ─── FILTER ROW ──────────────────────────────────────────── */}
      <View style={localStyles.filterRow}>
        <Text style={localStyles.filterLabel}>Filter by:</Text>
        <View style={localStyles.filterContainer}>
          {(["All", "Today", "Yesterday", "Range"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                localStyles.filterButton,
                dateFilter === opt && localStyles.filterButtonActive,
              ]}
              onPress={() => {
                setDateFilter(opt);
                setShowAll(false);
              }}
            >
              <Text
                style={[
                  localStyles.filterText,
                  dateFilter === opt && localStyles.filterTextActive,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Range Pickers */}
      {dateFilter === "Range" && (
        <View style={localStyles.rangePickers}>
          {Platform.OS === "web" ? (
            <>
              <Text style={localStyles.rangeLabel}>Start:</Text>
              <input
                type="date"
                style={localStyles.webDateInput}
                value={
                  dateRange.start
                    ? formatChicagoDateForInput(dateRange.start)
                    : ""
                }
                onChange={(e) => {
                  const d = parseChicagoInput(e.target.value);
                  setDateRange((r) => ({ ...r, start: d }));
                }}
              />
              <Text style={localStyles.rangeLabel}>End:</Text>
              <input
                type="date"
                style={localStyles.webDateInput}
                value={
                  dateRange.end ? formatChicagoDateForInput(dateRange.end) : ""
                }
                onChange={(e) => {
                  const d = parseChicagoInput(e.target.value);
                  setDateRange((r) => ({ ...r, end: d }));
                }}
              />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={localStyles.datePickerButton}
                onPress={() => setShowPicker("start")}
              >
                <Text style={localStyles.datePickerText}>
                  Start:{" "}
                  {dateRange.start
                    ? dateRange.start.toLocaleDateString("en-US", {
                        timeZone: "America/Chicago",
                      })
                    : "Select"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={localStyles.datePickerButton}
                onPress={() => setShowPicker("end")}
              >
                <Text style={localStyles.datePickerText}>
                  End:{" "}
                  {dateRange.end
                    ? dateRange.end.toLocaleDateString("en-US", {
                        timeZone: "America/Chicago",
                      })
                    : "Select"}
                </Text>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  value={dateRange[showPicker] || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onChangeRange(showPicker)}
                />
              )}
            </>
          )}
        </View>
      )}
      {/* ─── TABS ──────────────────────────────────────────────────── */}
      <View style={localStyles.tabContainer}>
        <TouchableOpacity
          style={[
            localStyles.tabButton,
            selectedTab === "swipes" && localStyles.activeTab,
          ]}
          onPress={() => {
            setSelectedTab("swipes");
            setShowAll(false);
          }}
        >
          <Text
            style={[
              localStyles.tabText,
              selectedTab === "swipes" && localStyles.activeTabText,
            ]}
          >
            Meal Swipes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            localStyles.tabButton,
            selectedTab === "flex" && localStyles.activeTab,
          ]}
          onPress={() => {
            setSelectedTab("flex");
            setShowAll(false);
          }}
        >
          <Text
            style={[
              localStyles.tabText,
              selectedTab === "flex" && localStyles.activeTabText,
            ]}
          >
            Flex Dollars
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── TRANSACTIONS TABLE ──────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 20 }} />
      ) : (
        <ScrollView horizontal contentContainerStyle={localStyles.tableWrapper}>
          <View
            style={[
              localStyles.tableContainer,
              { minWidth: SCREEN_WIDTH - 40 },
            ]}
          >
            <View style={localStyles.tableRowHeader}>
              <Text style={localStyles.tableCellHeader}>Date</Text>
              <Text style={localStyles.tableCellHeader}>Mode</Text>
              <Text style={localStyles.tableCellHeader}>Location</Text>
              {selectedTab === "flex" && (
                <Text style={localStyles.tableCellHeader}>Amount</Text>
              )}
              <Text style={localStyles.tableCellHeader}>Transaction ID</Text>
            </View>

            {displayed.map((t, i) => (
              <View key={i} style={localStyles.tableRow}>
                <Text style={localStyles.tableCell}>
                {formatDallasDateTime(t.transaction_date)}
                </Text>
                <Text style={localStyles.tableCell}>{t.transaction_mode}</Text>
                <Text
                  style={[
                    localStyles.tableCell,
                    {
                      color: t.Location === "Chick-fil-A" ? "red" : "brown",
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {t.Location}
                </Text>
                {selectedTab === "flex" && (
                  <Text style={localStyles.tableCell}>
                    {t.Total_Amount.toFixed(2)}
                  </Text>
                )}
                <Text style={localStyles.tableCell}>{t.transaction_id}</Text>
              </View>
            ))}

            {filtered.length > 5 && (
              <View style={localStyles.showMoreContainer}>
                <TouchableOpacity onPress={() => setShowAll((s) => !s)}>
                  <Text style={localStyles.showMoreText}>
                    {showAll ? "Show Less" : "Show More"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  balanceContainer: {
    position: "absolute" as const,
    top: 16,
    left: 600,
    right: 600,
    backgroundColor: "#FFF",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 42,
    elevation: 6,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: "center",
    zIndex: 10,
    borderColor: "brown",
  },
  planText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  balanceIcon: {
    marginRight: 6,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  rangePickers: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 1300,
    marginTop: 30,
  },
  rangeLabel: {
    fontSize: 14,
    marginRight: 4,
    color: "#333",
  },
  datePickerButton: {
    marginLeft: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
  },
  datePickerText: {
    fontSize: 14,
  },
  webDateInput: {
    width: 140,
    height: 32,
    marginRight: 12,
  },

  upgradeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 15,
    borderColor: "brown",
  },
  upgradeText: {
    color: "#005fa8",
    fontWeight: "600",
  },
  upgradeHover: {
    backgroundColor: "#E6F7FF",
  },
  upgradePressed: {
    opacity: 0.8,
  },

  filterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 200, // extra space under balance card
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
    color: "#444",
  },
  filterContainer: {
    flexDirection: "row",
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#888",
    backgroundColor: "#fff",
  },
  filterButtonActive: {
    backgroundColor: "#8B2E26",
    borderColor: "#8B2E26",
  },
  filterText: {
    color: "#444",
  },
  filterTextActive: {
    color: "#fff",
  },

  tableContainer: {
    borderWidth: 1,
    borderColor: "#ddd",

    padding: 56,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 600,
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
    borderColor: "#ddd",
    borderWidth: 1,
  },
  activeTab: {
    backgroundColor: "brown",
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: "#555",
  },
  activeTabText: {
    color: "white",
    fontWeight: "bold",
  },

  tableWrapper: {
    paddingHorizontal: 16,
    marginVertical: 24,
  },

  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "brown",
    paddingVertical: 10,
    borderRadius: 12,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  tableCellHeader: {
    flex: 1,
    minWidth: 100,
    textAlign: "center",
    fontWeight: "600",
    color: "#fff",
  },
  tableCell: {
    flex: 1,
    minWidth: 100,
    textAlign: "center",
    fontSize: 14,
    color: "#333",
  },

  showMoreContainer: {
    alignSelf: "flex-end",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007bff",
  },
});
