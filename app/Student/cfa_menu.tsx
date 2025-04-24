// screens/MenuItemsScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { cfaImages } from "../styles/cfa_images";

type MenuAPIItem = {
  menu_id: number;
  item_title: string;
  item_description: string;
  calories: number;
  price: number;
  category_id: number;
};

export type MenuItem = {
  id: number;
  name: string;
  description: string;
  calories: number;
  price: string;
  category: string;
  image: any;
};

const categoryMap: Record<number, string> = {
  4: "Entree",
  1: "Sides",
  7: "Nuggets",
  2: "Deserts",
  3: "Drinks",
  5: "Sauces",
  6: "Additional Items",
};

const categories = [
  "Entree",
  "Sides",
  "Nuggets",
  "Deserts",
  "Drinks",
  "Sauces",
  "Additional Items",
];

const defaultImage = require("../../assets/images/swipee.jpg");

export default function MenuItemsScreen() {
  const [menuData, setMenuData]                 = useState<MenuItem[]>([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds]           = useState<Set<number>>(new Set());
  const [target, setTarget]                     = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://127.0.0.1:8081/CFA_Menu/");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MenuAPIItem[] = await res.json();
        setMenuData(
          data.map(i => ({
            id: i.menu_id,
            name: i.item_title,
            description: i.item_description,
            calories: i.calories,
            price: `$${i.price.toFixed(2)}`,
            category: categoryMap[i.category_id] || "Additional Items",
            image: cfaImages[i.item_title] || defaultImage,
          }))
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleCategory = (cat: string) =>
    setExpandedCategory(c => (c === cat ? null : cat));

  const toggleSelect = (id: number) => {
    setSelectedIds(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalCalories = [...selectedIds].reduce((sum, id) => {
    const itm = menuData.find(i => i.id === id);
    return sum + (itm?.calories || 0);
  }, 0);

  const over = target !== null && totalCalories > target;

  return (
    <View style={styles.outerContainer}>
      {/* LEFT 70% */}
      <ScrollView style={styles.leftPane} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/CFA_Logo.svg")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          categories.map(cat => {
            const items = menuData.filter(i => i.category === cat);
            if (!items.length) return null;
            return (
              <View key={cat} style={styles.categorySection}>
                <TouchableOpacity
                  style={styles.categoryHeaderContainer}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text style={styles.categoryHeader}>{cat}</Text>
                  <Text style={styles.toggleIcon}>
                    {expandedCategory === cat ? "–" : "+"}
                  </Text>
                </TouchableOpacity>
                {expandedCategory === cat && (
                  <View style={styles.grid}>
                    {items.map(item => {
                      const sel = selectedIds.has(item.id);
                      return (
                        <Pressable
  key={item.id}
  onPress={() => toggleSelect(item.id)}
  style={({ hovered, pressed }) => [
    styles.card,
    sel && styles.cardSelected,
    hovered && styles.cardHover,    // ← new hover highlight
    pressed && { opacity: 0.6 },    // ← same as your old pressed feedback
  ]}
>
                          <Image
                            source={item.image}
                            style={styles.cardImage}
                            resizeMode="cover"
                          />
                          <View style={styles.cardText}>
                            <Text style={styles.cardName}>{item.name}</Text>
                            <Text style={styles.cardCalories}>
                              {item.calories} kcal
                            </Text>
                          </View>
                          <Text style={styles.cardPrice}>{item.price}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* RIGHT 30% */}
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
          onChangeText={t => setTarget(t ? parseInt(t, 10) : null)}
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

const styles = StyleSheet.create({
  outerContainer: { flex: 1, flexDirection: "row" },

  // LEFT 70%
  leftPane: { flex: 0.8, backgroundColor: "#fff" },
  header: { alignItems: "center", marginVertical: 35 },
  logo: { width: "100%", height: 100 },
  error: { color: "red", padding: 16 },

  categorySection: { marginBottom: 34 },
  categoryHeaderContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryHeader: {
    fontSize: 22,
    fontWeight: "bold",
    marginRight: 8,
    marginBottom: 18,
  },
  toggleIcon: { fontSize: 22, color: "red",marginBottom: 18 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 10,
  },
  card: {
    width: "16%",          // four across
    backgroundColor: "#fafafa",
    borderRadius: 22,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "transparent",
    marginHorizontal: 4.5,
    marginRight: 30,
  },
  cardSelected: {
    borderColor: "#c41200",
    backgroundColor: "#fff0f0",
  },
  cardImage: {
    width: "86%",
    height: 190,
    borderRadius: 20,     // taller, like before
  },
  cardText: { padding: 8, alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  cardCalories: { marginTop: 4, color: "#666" },
  cardPrice: {
    padding: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#c41200",
    textAlign: "center",
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
    color: "red",
  },
  label: { fontSize: 16, marginBottom: 9,  },
  input: {
    borderWidth: 4,
    borderColor: "#aaa",
    borderRadius: 20,
    padding: 10,
    backgroundColor: "#fff",
    marginBottom: 40,
    fontSize: 16,
  },
  summary: { marginTop: 1 },
  summaryText: { fontSize: 16, marginTop: 1 },
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
