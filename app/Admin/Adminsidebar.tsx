// AdminSidebar.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";

/* ---------- menu definitions (full paths) ---------- */
const main = [
  { label: "Dashboard", path: "/Admin", icon: "home-outline" },
  { label: "User Management", icon: "people-outline" },
  {
    label: "Swipe History",
    path: "/Admin/Admin_users/SwipeHistory",
    icon: "calendar-outline",
  },
  {
    label: "Recent Transactions",
    path: "/Admin/Admin_users/Transactions",
    icon: "calculator-outline",
  },
  { label: "Menu Management", icon: "restaurant-outline" },
  { label: "Logout", path: "/", icon: "log-out-outline" },
] as const;

const userSub = [
  {
    label: "Students",
    path: "/Admin/Admin_users/students",
    icon: "school-outline",
  },
  {
    label: "Employees",
    path: "/Admin/Admin_users/employees",
    icon: "person-outline",
  },
] as const;

const menuSub = [
  {
    label: "Chick-fil-A",
    path: "/Admin/Admin_menu/CFA_menu",
    icon: "calculator-outline",
  },
  {
    label: "Mesquite Dining",
    path: "/Admin/Admin_menu/dining_menu",
    icon: "restaurant-outline",
  },
] as const;

const recentSub = [
  {
    label: "Meal Swipes & Flex Dollars",
    path: "/Admin/Transactions/Meal_flex",
    icon: "fast-food-outline",
  },
  {
    label: "Cash & Card",
    path: "/Admin/Transactions/cash_card",
    icon: "card-outline",
  },
  {
    label: "Employee Meal",
    path: "/Admin/Transactions/employee_meal",
    icon: "people-circle-outline",
  },
] as const;

type SectionLabel = (typeof main)[number]["label"];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState<SectionLabel | null>(null);

  // Auto-open if you land on a subpage
  useEffect(() => {
    if (userSub.some((s) => s.path === pathname)) {
      setExpanded("User Management");
    } else if (menuSub.some((s) => s.path === pathname)) {
      setExpanded("Menu Management");
    } else if (recentSub.some((s) => s.path === pathname)) {
      setExpanded("Recent Transactions");
    } else {
      setExpanded(null);
    }
  }, [pathname]);

  // Helper to highlight exact matches
  const isActive = (p?: string) => p === pathname;

  // Click handler for top-level items
  const onPressMain = (item: (typeof main)[number]) => {
    if (
      item.label === "User Management" ||
      item.label === "Menu Management" ||
      item.label === "Recent Transactions"
    ) {
      setExpanded((prev) => (prev === item.label ? null : item.label));
    } else if (item.path) {
      router.push(item.path as never);
    }
  };

  return (
    <ScrollView style={styles.sidebar}>
      <Text style={styles.title}>Admin Dashboard</Text>

      {main.map((item) => {
        const open = expanded === item.label;
        const active =
          (item.label === "User Management" &&
            userSub.some((s) => s.path === pathname)) ||
          (item.label === "Menu Management" &&
            menuSub.some((s) => s.path === pathname)) ||
          (item.label === "Recent Transactions" &&
            recentSub.some((s) => s.path === pathname)) ||
          isActive(item.label);

        return (
          <View key={item.label}>
            <Pressable
              onPress={() => onPressMain(item)}
              style={({ hovered }) => [
                styles.menuItem,
                hovered && styles.menuItemHover,
                active && styles.menuItemActive,
              ]}
            >
              <Ionicons name={item.icon as any} size={20} color="#00BFFF" />
              <Text style={styles.menuText}>{item.label}</Text>
              {(item.label === "User Management" ||
                item.label === "Menu Management" ||
                item.label === "Recent Transactions") && (
                <Ionicons
                  name={
                    open ? "chevron-down-outline" : "chevron-forward-outline"
                  }
                  size={16}
                  color="#00BFFF"
                  style={styles.expandIcon}
                />
              )}
            </Pressable>

            {/* User Management submenu */}
            {item.label === "User Management" && open && (
              <View style={styles.subMenuContainer}>
                {userSub.map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={() => router.push(s.path as never)}
                    style={({ hovered }) => [
                      styles.menuItem,
                      styles.subMenuItem,
                      hovered && styles.menuItemHover,
                      isActive(s.path) && styles.menuItemActive,
                    ]}
                  >
                    <Ionicons
                      name={s.icon as any}
                      size={18}
                      color="#00BFFF"
                    />
                    <Text style={styles.menuText}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Recent Transactions submenu */}
            {item.label === "Recent Transactions" && open && (
              <View style={styles.subMenuContainer}>
                {recentSub.map((r) => (
                  <Pressable
                    key={r.label}
                    onPress={() => router.push(r.path as never)}
                    style={({ hovered }) => [
                      styles.menuItem,
                      styles.subMenuItem,
                      hovered && styles.menuItemHover,
                      isActive(r.path) && styles.menuItemActive,
                    ]}
                  >
                    <Ionicons
                      name={r.icon as any}
                      size={18}
                      color="#00BFFF"
                    />
                    <Text style={styles.menuText}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Menu Management submenu */}
            {item.label === "Menu Management" && open && (
              <View style={styles.subMenuContainer}>
                {menuSub.map((m) => (
                  <Pressable
                    key={m.label}
                    onPress={() => router.push(m.path as never)}
                    style={({ hovered }) => [
                      styles.menuItem,
                      styles.subMenuItem,
                      hovered && styles.menuItemHover,
                      isActive(m.path) && styles.menuItemActive,
                    ]}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={18}
                      color="#00BFFF"
                    />
                    <Text style={styles.menuText}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  menuItemHover: {
    backgroundColor: "#F5F5F5",
  },
  menuItemActive: {
    backgroundColor: "#E6F7FF",
  },
  menuText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
  expandIcon: {
    marginLeft: "auto",
    marginRight: 8,
  },
  subMenuContainer: {
    marginLeft: 24,
    borderLeftWidth: 2,
    borderLeftColor: "#e0e0e0",
    paddingLeft: 12,
  },
  subMenuItem: {
    marginBottom: 4,
  },
});
