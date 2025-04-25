// app/Transactions.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";

type TransactionRow = {
  username: string;
  first_name: string;
  last_name: string;
  transaction_mode: string;
  Total_Amount: number;
  Location: string;
  transaction_date: string; // ISO or naive
};

export default function Transactions() {
  const [allTxs, setAllTxs] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "All" | "Today" | "Yesterday" | "Range"
  >("All");
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [showPicker, setShowPicker] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    axios
      .get<TransactionRow[]>("http://127.0.0.1:8081/Transactions/")
      .then(({ data }) => {
        const cashCardOnly = data.filter(
          (tx) => tx.transaction_mode === "Cash" || tx.transaction_mode === "Card"
        );
        cashCardOnly.sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() -
            new Date(a.transaction_date).getTime()
        );
        setAllTxs(cashCardOnly);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Helpers: always in America/Chicago (Dallas) ──
// Parse to Date from ISO string
const parseDate = (iso: string) => new Date(iso);

// Format to M/D/YYYY, h:mm AM/PM in local time
const formatLocalDateTime = (iso: string) =>
  new Date(iso).toLocaleString(); // shows local time

// Format to YYYY-MM-DD for consistent comparison
const toYMD = (d: Date) => d.toISOString().slice(0, 10);

// Calculate today and yesterday in local time
const now = new Date();
const todayYMD = new Date().toLocaleDateString("sv-SE"); // ✅ gives 'YYYY-MM-DD' in local time

const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterdayYMD = yesterdayDate.toLocaleDateString("sv-SE");


  const onChangeRange =
    (which: "start" | "end") =>
    (_: any, picked?: Date) => {
      setShowPicker(null);
      if (picked) {
        setDateRange((r) => ({ ...r, [which]: picked }));
      }
    };

  // ── Filter + sort ──
  const filtered = allTxs
  .filter((tx) => {
    const q = searchText.trim().toLowerCase();
    if (
      q &&
      !tx.first_name.toLowerCase().includes(q) &&
      !tx.last_name.toLowerCase().includes(q)
    ) return false;

    const txDate = new Date(tx.transaction_date);
    const txYMD = new Date(tx.transaction_date).toLocaleDateString("sv-SE");


    if (dateFilter === "Today") return txYMD === todayYMD;
    if (dateFilter === "Yesterday") return txYMD === yesterdayYMD;
    if (dateFilter === "Range") {
      const { start, end } = dateRange;
      if (start && end) {
        return txDate >= start && txDate <= end;
      }
    }

    return true;
  })
  .sort((a, b) =>
    new Date(b.transaction_date).getTime() -
    new Date(a.transaction_date).getTime()
  );


  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={[styles.row, styles.headerRow]}>
      <Text style={[styles.cell, styles.medium]}>First Name</Text>
      <Text style={[styles.cell, styles.medium]}>Mode</Text>
      <Text style={[styles.cell, styles.small]}>Amount</Text>
      <Text style={[styles.cell, styles.medium]}>Location</Text>
      <Text style={[styles.cell, styles.medium]}>Date & Time</Text>
    </View>
  );

  const renderItem = ({ item }: { item: TransactionRow }) => (
    <View style={styles.row}>
      <Text style={[styles.cell, styles.medium]}>{item.first_name}</Text>
      <Text style={[styles.cell, styles.medium]}>{item.transaction_mode}</Text>
      <Text style={[styles.cell, styles.small]}>
        {item.Total_Amount.toFixed(2)}
      </Text>
      <Text style={[styles.cell, styles.medium]}>{item.Location}</Text>
      <Text style={[styles.cell, styles.medium]}>
        {formatLocalDateTime(item.transaction_date)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Search & Date Filters ── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search First / Last"
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.filterRow}>
          {(["All", "Today", "Yesterday", "Range"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterBtn,
                dateFilter === f && styles.filterBtnActive,
              ]}
              onPress={() => setDateFilter(f)}
            >
              <Text
                style={
                  dateFilter === f ? styles.filterTextActive : styles.filterText
                }
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {dateFilter === "Range" && (
          <View style={styles.rangeRow}>
            <TouchableOpacity
              style={styles.smallDateBtn}
              onPress={() => setShowPicker("start")}
            >
              <Ionicons name="calendar-outline" size={18} />
              <Text style={styles.smallDateText}>
              <Text style={styles.smallDateText}>
  {dateRange.start ? toYMD(dateRange.start) : "Start"}
</Text>

              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallDateBtn}
              onPress={() => setShowPicker("end")}
            >
              <Ionicons name="calendar-outline" size={18} />
              <Text style={styles.smallDateText}>
              <Text style={styles.smallDateText}>
  {dateRange.end ? toYMD(dateRange.end) : "End"}
</Text>

              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showPicker &&
          (Platform.OS === "web" ? (
            <input
              type="date"
              style={styles.webDateInput}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) {
                  setDateRange((r) => ({ ...r, [showPicker]: d }));
                }
                setShowPicker(null);
              }}
            />
          ) : (
            <DateTimePicker
              value={
                showPicker === "start"
                  ? dateRange.start || new Date()
                  : dateRange.end || new Date()
              }
              mode="date"
              display="calendar"
              onChange={onChangeRange(showPicker)}
            />
          ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(_, idx) => `tx-${idx}`}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchContainer: {
    padding: 12,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  searchInput: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  filterRow: { flexDirection: "row", marginBottom: 8 },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#888",
    marginRight: 8,
  },
  filterBtnActive: { backgroundColor: "#888" },
  filterText: { color: "#444" },
  filterTextActive: { color: "#fff" },

  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  smallDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 12,
  },
  smallDateText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#444",
  },
  webDateInput: {
    marginTop: 8,
    width: 140,
    height: 32,
  },

  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerRow: {
    backgroundColor: "#f7f7f7",
    borderBottomWidth: 2,
    borderColor: "#ccc",
  },
  cell: { paddingHorizontal: 4 },
  small: { flex: 1, fontSize: 12 },
  medium: { flex: 2, fontSize: 14 },
});
