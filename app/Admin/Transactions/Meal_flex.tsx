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

type RawTransaction = {
  transaction_date: string;  // ISO string, e.g. "2025-04-25T14:42:00"
  transaction_mode: string;
  transaction_id: string;
  Total_Amount: number;
  Location: string;
};

type Student = {
  username: string;
  first_name: string;
  last_name: string;
  transactions: RawTransaction[];
};

type TransactionRow = {
  username: string;
  first_name: string;
  last_name: string;
  transaction_mode: string;
  Total_Amount: number;
  Location: string;
  transaction_date: string;
};

export default function Transactions() {
  const [allTxs, setAllTxs] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState<"All"|"Today"|"Yesterday"|"Range">("All");
  const [dateRange, setDateRange] = useState<{ start: Date|null; end: Date|null }>({
    start: null,
    end: null,
  });
  const [showPicker, setShowPicker] = useState<"start"|"end"|null>(null);

  useEffect(() => {
    axios
      .get<Student[]>("http://127.0.0.1:8081/student_users_swipes/")
      .then(({ data }) => {
        const flat: TransactionRow[] = data.flatMap((stu) =>
          stu.transactions.map((tx) => ({
            username: stu.username,
            first_name: stu.first_name,
            last_name: stu.last_name,
            transaction_mode: tx.transaction_mode,
            Total_Amount: tx.Total_Amount,
            Location: tx.Location,
            transaction_date: tx.transaction_date,
          }))
        );
        setAllTxs(flat);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Helpers for Dallas/Chicago time ──

  // Format YYYY-MM-DD from ISO string, no timezone conversion
const formatYMDFromISO = (iso: string): string => {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10); // always in UTC
};

// Format local date+time from raw ISO
const formatDateTime = (d: Date): string => {
  return d.toLocaleString(); // local time display
};

// Today & yesterday in local time
const now = new Date();
const todayYMD = new Date().toLocaleDateString("sv-SE");

const yesterday = new Date();
yesterday.setDate(now.getDate() - 1);
const yesterdayYMD = yesterday.toLocaleDateString("sv-SE");


  const onChangeRange =
    (which: "start"|"end") =>
    (_: any, picked?: Date) => {
      setShowPicker(null);
      if (picked) setDateRange(r => ({ ...r, [which]: picked }));
    };

  // ── apply search + date filters ──
  const filtered = allTxs
  .filter(tx => {
    const q = searchText.trim().toLowerCase();
    if (
      q &&
      !tx.username.toLowerCase().includes(q) &&
      !tx.first_name.toLowerCase().includes(q) &&
      !tx.last_name.toLowerCase().includes(q)
    ) return false;

    const txDate = new Date(tx.transaction_date);
    const txY = txDate.toLocaleDateString("sv-SE"); // 'YYYY-MM-DD' in local time



    if (dateFilter === "Today") return txY === todayYMD;
    if (dateFilter === "Yesterday") return txY === yesterdayYMD;
    if (dateFilter === "Range") {
      const { start, end } = dateRange;
      if (start && end) {
        return txDate >= start && txDate <= end;
      }
    }

    return true;
  })
  .sort(
    (a, b) =>
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
      <Text style={[styles.cell, styles.small]}>M Number</Text>
      <Text style={[styles.cell, styles.medium]}>First Name</Text>
      <Text style={[styles.cell, styles.medium]}>Last Name</Text>
      <Text style={[styles.cell, styles.medium]}>Mode</Text>
      <Text style={[styles.cell, styles.small]}>Amount</Text>
      <Text style={[styles.cell, styles.medium]}>Location</Text>
      <Text style={[styles.cell, styles.medium]}>Date & Time</Text>
    </View>
  );

  const renderItem = ({ item }: { item: TransactionRow }) => {
    const dt = new Date(item.transaction_date); // no UTC or timezone parsing

    return (
      <View style={styles.row}>
        <Text style={[styles.cell, styles.small]}>{item.username}</Text>
        <Text style={[styles.cell, styles.medium]}>{item.first_name}</Text>
        <Text style={[styles.cell, styles.medium]}>{item.last_name}</Text>
        <Text style={[styles.cell, styles.medium]}>{item.transaction_mode}</Text>
        <Text style={[styles.cell, styles.small]}>{item.Total_Amount.toFixed(2)}</Text>
        <Text style={[styles.cell, styles.medium]}>{item.Location}</Text>
        <Text style={[styles.cell, styles.medium]}>
          {formatDateTime(dt)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Search & Date Filters ── */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search M-Number / First / Last"
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.filterRow}>
          {(["All","Today","Yesterday","Range"] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, dateFilter===f && styles.filterBtnActive]}
              onPress={() => setDateFilter(f)}
            >
              <Text style={dateFilter===f ? styles.filterTextActive : styles.filterText}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {dateFilter==="Range" && (
          <View style={styles.rangeRow}>
            <TouchableOpacity style={styles.smallDateBtn} onPress={()=>setShowPicker("start")}>
              <Ionicons name="calendar-outline" size={18} />
              <Text style={styles.smallDateText}>
              {dateRange.start ? dateRange.start.toISOString().slice(0, 10) : "Start"}

              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallDateBtn} onPress={()=>setShowPicker("end")}>
              <Ionicons name="calendar-outline" size={18} />
              <Text style={styles.smallDateText}>
              {dateRange.end ? dateRange.end.toISOString().slice(0, 10) : "End"}

              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showPicker && (Platform.OS==="web" ? (
          <input
            type="date"
            style={styles.webDateInput}
            onChange={e=>{
              const d = new Date(e.target.value);
              if(!isNaN(d.getTime()))
                setDateRange(r=>({ ...r, [showPicker]: d }));
              setShowPicker(null);
            }}
          />
        ) : (
          <DateTimePicker
            value={ showPicker==="start"? dateRange.start||new Date() : dateRange.end||new Date() }
            mode="date"
            display="calendar"
            onChange={onChangeRange(showPicker)}
          />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(_,idx)=>`tx-${idx}`}
        ListHeaderComponent={renderHeader}
        stickyHeaderIndices={[0]}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:"#fff" },
  loader: { flex:1, justifyContent:"center",alignItems:"center" },

  searchContainer: {
    padding:12,
    backgroundColor:"#fafafa",
    borderBottomWidth:1,
    borderColor:"#ddd",
  },
  searchInput: {
    height:40,
    borderColor:"#ccc",
    borderWidth:1,
    borderRadius:4,
    paddingHorizontal:8,
    marginBottom:8,
  },
  filterRow: { flexDirection:"row", marginBottom:8 },
  filterBtn: {
    paddingVertical:6,
    paddingHorizontal:12,
    borderRadius:4,
    borderWidth:1,
    borderColor:"#888",
    marginRight:8,
  },
  filterBtnActive: { backgroundColor:"#888" },
  filterText: { color:"#444" },
  filterTextActive: { color:"#fff" },

  rangeRow: {
    flexDirection:"row",
    alignItems:"center",
  },
  smallDateBtn: {
    flexDirection:"row",
    alignItems:"center",
    borderWidth:1,
    borderColor:"#888",
    borderRadius:4,
    paddingVertical:4,
    paddingHorizontal:8,
    marginRight:12,
  },
  smallDateText: {
    marginLeft:4,
    fontSize:14,
    color:"#444",
  },
  webDateInput:{ marginTop:8, width:140, height:32 },

  row: {
    flexDirection:"row",
    paddingVertical:8,
    borderBottomWidth:1,
    borderColor:"#eee",
  },
  headerRow: {
    backgroundColor:"#f7f7f7",
    borderBottomWidth:2,
    borderColor:"#ccc",
  },
  cell: { paddingHorizontal:4 },
  small: { flex:1, fontSize:12 },
  medium:{ flex:2, fontSize:14 },
});
