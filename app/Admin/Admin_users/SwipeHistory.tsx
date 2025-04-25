// app/Admin/SwipeHistory.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { styles } from '../admin_styles/swipe_history';

// enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* Types */
type Transaction = {
  transaction_date: string;   // ISO datetime
  transaction_mode: string;
  transaction_id: string;
  Total_Amount: number;
  Location: string;
};

type Student = {
  username: string;
  first_name: string;
  last_name: string;
  meal_plan: string;
  meal_swipes: number;
  flex_dollars: number;
  transactions: Transaction[];
};

const FILTERS = ['All', 'Meal swipes', 'Flex dollars'] as const;

export default function SwipeHistory() {
  const [students, setStudents] = useState<Student[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [filterMap, setFilterMap] = useState<Record<string, typeof FILTERS[number]>>({});
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data } = await axios.get<Student[]>('http://127.0.0.1:8081/student_users_swipes/');
      setStudents(data);
    } catch (err) {
      console.error('Error fetching swipe history:', err);
    }
  };

  // ── Helpers for Dallas/Chicago time ──

  const parseDate = (iso: string): Date => new Date(iso);
  const formatDateTime = (iso: string): string =>
    new Date(iso).toLocaleString("en-US");


  const toggleExpand = (username: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = !expandedMap[username];
    setExpandedMap({ [username]: willExpand });
    if (willExpand) {
      setFilterMap({ [username]: 'All' });
      setShowAllMap({ [username]: false });
    }
  };
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const loc = item.Location.toLowerCase();
    const color = loc.includes("chick")
      ? "red"
      : loc.includes("dining")
      ? "maroon"
      : "black";
  
    return (
      <View style={styles.txRow}>
        <Text style={styles.txCell}>{formatDateTime(item.transaction_date)}</Text>
        <Text style={styles.txCell}>{item.transaction_mode}</Text>
        <Text style={[styles.txCell, { color }]}>{item.Location}</Text>
        <Text style={styles.txCell}>{item.Total_Amount.toFixed(2)}</Text>
        <Text style={styles.txCell}>{item.transaction_id}</Text>
      </View>
    );
  };
  

  const renderStudent = ({ item }: { item: Student }) => {
    const expanded = !!expandedMap[item.username];
    const filter = filterMap[item.username] || 'All';

    let txs = item.transactions.slice();
    if (filter !== 'All') {
      const key = filter === 'Meal swipes' ? 'swipe' : 'flex';
      txs = txs.filter(tx => tx.transaction_mode.toLowerCase().includes(key));
    }
    txs.sort(
      (a, b) =>
        parseDate(b.transaction_date).getTime() -
        parseDate(a.transaction_date).getTime()
    );

    const showAll = !!showAllMap[item.username];
    const displayedTxs = showAll ? txs : txs.slice(0, 5);

    return (
      <View>
        {/* summary row */}
        <TouchableOpacity onPress={() => toggleExpand(item.username)}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.small]}>{item.username}</Text>
            <Text style={[styles.cell, styles.medium]}>{item.first_name}</Text>
            <Text style={[styles.cell, styles.medium]}>{item.last_name}</Text>
            <Text style={[styles.cell, styles.medium]}>{item.meal_plan}</Text>
            <Text style={[styles.cell, styles.small]}>{item.meal_swipes}</Text>
            <Text style={[styles.cell, styles.small]}>
              {item.flex_dollars.toFixed(2)}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
              color="#333"
            />
          </View>
        </TouchableOpacity>

        {/* expanded transactions */}
        {expanded && (
          <View style={styles.expandedSection}>
            {/* type filters */}
            <View style={styles.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterBtn,
                    filterMap[item.username] === f && styles.filterBtnActive,
                  ]}
                  onPress={() =>
                    setFilterMap({ [item.username]: f })
                  }
                >
                  <Text
                    style={
                      filterMap[item.username] === f
                        ? styles.filterTextActive
                        : styles.filterText
                    }
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* transactions list */}
            <FlatList
              data={displayedTxs}
              keyExtractor={(tx, i) => `${item.username}-tx-${i}`}
              renderItem={renderTransaction}
              ListHeaderComponent={() => (
                <View style={styles.txHeaderRow}>
                  <Text style={styles.txHeaderCell}>Date & Time</Text>
                  <Text style={styles.txHeaderCell}>Payment Mode</Text>
                  <Text style={styles.txHeaderCell}>Location</Text>
                  <Text style={styles.txHeaderCell}>Amount</Text>
                  <Text style={styles.txHeaderCell}>Txn ID</Text>
                </View>
              )}
              ListFooterComponent={() =>
                txs.length > 5 ? (
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() =>
                      setShowAllMap({ [item.username]: !showAll })
                    }
                  >
                    <Text style={styles.showMoreText}>
                      {showAll ? 'Show Less' : 'Show More'}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        )}
      </View>
    );
  };

  const displayed = students.filter(s =>
    s.username.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Swipe History</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search MNumber…"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.small]}>Mustang Number</Text>
        <Text style={[styles.cell, styles.medium]}>First Name</Text>
        <Text style={[styles.cell, styles.medium]}>Last Name</Text>
        <Text style={[styles.cell, styles.medium]}>Meal Plan</Text>
        <Text style={[styles.cell, styles.small]}>Swipes Left</Text>
        <Text style={[styles.cell, styles.small]}>Flex $ Left</Text>
        <Text style={styles.cell}></Text>
      </View>

      <FlatList
        data={displayed}
        renderItem={renderStudent}
        keyExtractor={s => s.username}
      />
    </View>
  );
}
