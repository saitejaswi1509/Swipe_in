// screens/DiningMenuScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";

// Data shape from your Dining API
type DiningAPIItem = {
  menu_id: number;
  item_title: string;
  item_detail: string;
  portion: string;
  diet: string;
  date: string;
  calories: number;
  main_category: string;
  subcategory: string;
};

export type DiningItem = {
  id: number;
  title: string;
  detail: string;
  portion: string;
  diet: string;
  date: string;
  calories: number;
  mainCategory: string;
  subcategory: string;
};

// Default image if none is found
const defaultImage = require("../../assets/images/swipee.jpg");

// Simple useHover hook for web (ignored on native)
const useHover = () => {
  const [isHovered, setHovered] = useState(false);
  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };
  return { hoverProps, isHovered };
};

// MainCategory tab component
type MainCategoryProps = {
  category: string;
  isSelected: boolean;
  onSelect: () => void;
};
function MainCategory({ category, isSelected, onSelect }: MainCategoryProps) {
  const { hoverProps, isHovered } = useHover();
  const underlineStyle =
    isHovered || isSelected ? styles.categoryButtonTextSelected : null;

  return (
    <Pressable onPress={onSelect} style={styles.categoryButton} {...hoverProps}>
      <Text style={[styles.categoryButtonText, underlineStyle]}>
        {category.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// CategorySection for subcategory grouping
type CategorySectionProps = {
  cat: string;
  itemsForCat: DiningItem[];
  expandedCategory: string | null;
  toggleCategory: (cat: string) => void;
  selectedIds: Set<number>;
  toggleSelect: (id: number) => void;
};
function CategorySection({
  cat,
  itemsForCat,
  expandedCategory,
  toggleCategory,
  selectedIds,
  toggleSelect,
}: CategorySectionProps) {
  const { hoverProps } = useHover();
  const underlineStyle =
    expandedCategory === cat ? localStyles.categoryHeaderActive : null;

  return (
    <View style={localStyles.categorySection}>
      <Pressable onPress={() => toggleCategory(cat)} {...hoverProps}>
        <Text style={[localStyles.categoryHeader, underlineStyle]}>{cat}</Text>
      </Pressable>
      {expandedCategory === cat && (
        <View style={localStyles.categoryItemsGrid}>
          {itemsForCat.map((item) => {
            const sel = selectedIds.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleSelect(item.id)}
                style={({ hovered, pressed }) => [
                  localStyles.card,
                  sel && localStyles.cardSelected,
                  hovered && localStyles.cardHover,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={localStyles.textContainer}>
                  <Text style={localStyles.itemName}>{item.title}</Text>
                  <Text
                    style={
                      item.diet === "Vegan"
                        ? localStyles.diet1
                        : localStyles.diet
                    }
                  >
                    {item.diet}
                  </Text>
                  <Text style={localStyles.portion}>{item.portion}</Text>
                  <Text style={localStyles.calories}>{item.calories} Cal</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Date helper functions
function formatDateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function createLocalNoonDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}
function createLocalNoonDateForToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

export default function DiningMenuScreen() {
  const [menuData, setMenuData] = useState<DiningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mainCategories = ["Breakfast", "Lunch", "Dinner"];
  const [selectedCategory, setSelectedCategory] = useState("Breakfast");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Calorie calculator state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<number | null>(null);

  // Date picker state
  const [selectedDate, setSelectedDate] = useState<Date>(
    createLocalNoonDateForToday()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch data
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("http://127.0.0.1:8081/Dining_Menu/");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: DiningAPIItem[] = await response.json();
        setMenuData(
          data.map((item) => {
            const dateStr = item.date.includes("T")
              ? item.date.slice(0, 10)
              : item.date;
            return {
              id: item.menu_id,
              title: item.item_title,
              detail: item.item_detail,
              portion: item.portion,
              diet: item.diet,
              date: dateStr,
              calories: item.calories,
              mainCategory: item.main_category,
              subcategory: item.subcategory,
            };
          })
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter & group
  const filterDateStr = formatDateToYMD(selectedDate);
  const filtered = menuData.filter(
    (i) => i.mainCategory === selectedCategory && i.date === filterDateStr
  );
  const groupedItems = filtered.reduce((acc, i) => {
    (acc[i.subcategory] ||= []).push(i);
    return acc;
  }, {} as Record<string, DiningItem[]>);

  // Toggle subcategory & selection
  const toggleCategory = (cat: string) =>
    setExpandedCategory((prev) => (prev === cat ? null : cat));
  const toggleSelect = (id: number) =>
    setSelectedIds((s) => {
      const nxt = new Set(s);
      nxt.has(id) ? nxt.delete(id) : nxt.add(id);
      return nxt;
    });

  // Calorie total
  const totalCalories = [...selectedIds].reduce(
    (sum, id) => sum + (menuData.find((i) => i.id === id)?.calories || 0),
    0
  );
  const over = target !== null && totalCalories > target;

  // Date handlers
  const handleWebDateChange = (e: any) =>
    setSelectedDate(createLocalNoonDate(e.target.value));
  const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS !== "web") setShowDatePicker(false);
    if (date) setSelectedDate(new Date(date.setHours(12, 0, 0)));
  };

  return (
    <View style={styles.outerContainer}>
      {/* LEFT 70% */}
      <ScrollView showsVerticalScrollIndicator={false}
        style={styles.leftPane}
        contentContainerStyle={{ padding: 20 }}
      >
        {/* Header */}
        <View style={centerHeaderStyles.header}>
          <Text style={styles.mainHeader}>Mesquite Dining Hall</Text>
        </View>

        {/* Date Picker */}
        <View style={styles.datePickerContainer}>
          <Text style={styles.dateLabel}>Date</Text>
          {Platform.OS === "web" ? (
            <input
              type="date"
              value={filterDateStr}
              onChange={handleWebDateChange}
              style={styles.dateInputWeb}
            />
          ) : (
            <>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>{filterDateStr}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="calendar"
                  onChange={onDateChange}
                />
              )}
            </>
          )}
        </View>

        {/* Main Category Tabs */}
        <View style={styles.topCard}>
          <View style={styles.categoriesRow}>
            {mainCategories.map((cat) => (
              <MainCategory
                key={cat}
                category={cat}
                isSelected={selectedCategory === cat}
                onSelect={() => setSelectedCategory(cat)}
              />
            ))}
          </View>
        </View>

        {/* Subcategories */}
        {loading ? (
          <ActivityIndicator size="large" color="#000" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          Object.entries(groupedItems).map(([subcat, items]) => (
            <CategorySection
              key={subcat}
              cat={subcat}
              itemsForCat={items}
              expandedCategory={expandedCategory}
              toggleCategory={toggleCategory}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
            />
          ))
        )}
      </ScrollView>

      {/* RIGHT 30%: Calorie Calculator */}
      <KeyboardAvoidingView
        style={styles.rightPane}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.calcHeader}>Calorie Calculator</Text>
        <Text style={styles.label}>Enter your goal:</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 800"
          keyboardType="number-pad"
          value={target !== null ? String(target) : ""}
          onChangeText={(t) => setTarget(t ? parseInt(t, 10) : null)}
        />
        <View style={styles.summary}>
          <Text style={styles.summaryText}>Total: {totalCalories} kcal</Text>
          {target !== null && (
            <Text style={[styles.summaryText, over && styles.overWarning]}>
              {over
                ? "⚠️ Over your goal!"
                : `✅ ${target - totalCalories} kcal left`}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const centerHeaderStyles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
});

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  leftPane: {
    flex: 0.7,
  },
  mainHeader: {
    fontSize: 32,
    fontWeight: "bold",
    color: "rgb(198,2,2)",
    textAlign: "center",
    marginVertical: 20,
  },

  datePickerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateInputWeb: {
    padding: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
  },
  dateButton: {
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 6,
  },
  dateButtonText: {
    color: "#fff",
    fontSize: 16,
  },

  topCard: {
    marginVertical: 16,
  },
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  categoryButton: {
    paddingVertical: 8,
    marginRight: 40
  },
  categoryButtonText: {
    fontSize: 25,
    fontWeight: "bold",
  },
  categoryButtonTextSelected: {
    borderBottomWidth: 3,
    borderBottomColor: "rgb(198,2,2)",
    paddingBottom: 2,
  },

  error: {
    color: "red",
    textAlign: "center",
    marginTop: 20,
  },

  // RIGHT 30%
  rightPane: {
    flex: 0.2,
    backgroundColor: "#f5f5f5",
    padding: 20,
    borderLeftWidth: 1,
    borderLeftColor: "brown",
    borderTopLeftRadius: 200,
    borderBottomLeftRadius: 200,
    justifyContent: "center",
  },
  calcHeader: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 38,
    textAlign: "center",
    color: "brown",
  },
  label: { fontSize: 16, marginBottom: 8 },
  input: {
    borderWidth: 4,
    borderColor: "#aaa",
    borderRadius: 20,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 40,
    fontSize: 16,
  },
  summary: { marginTop: 2 },
  summaryText: { fontSize: 16, marginVertical: 2 },
  overWarning: {
    color: "#c41200",
    fontWeight: "700",
    textAlign: "center",
  },
  cardHover: {
    borderColor: "#c41200",
    backgroundColor: "#fff0f0",
  },
});

const localStyles = StyleSheet.create({
  categorySection: {
    marginBottom: 30,
  },
  categoryHeader: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2a44",
    textAlign: "center",
    marginVertical: 10,
  },
  categoryHeaderActive: {
    borderBottomWidth: 9,
    borderBottomColor: "brown",
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginHorizontal: 550,
  },
  categoryItemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  card: {
    width: "23%",
    backgroundColor: "#fff",
    borderRadius: 19,
    margin: 14,
    elevation: 3,
    alignItems: "center",
    paddingVertical: 10,
  },
  textContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  calories: {
    fontSize: 14,
    color: "red",
    fontWeight: "600",
    marginTop: 4,
  },
  diet: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    marginTop: 4,
  },
  diet1: {
    fontSize: 14,
    color: "green",
    marginTop: 4,
    fontWeight: "600",
  },
  portion: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "rgb(198,2,2)",
    backgroundColor: "#fff0f0",
  },
  cardHover: {
    backgroundColor: "#fef0f0",
  },
});

export { DiningMenuScreen };
