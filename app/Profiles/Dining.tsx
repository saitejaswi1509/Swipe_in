import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Platform,
  LayoutChangeEvent,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useNavigation } from "@react-navigation/native";
import { styles, modalStyles } from "../styles/dining";
import uuid from "react-native-uuid";
import { useAuth } from "../AuthContext";
import LottieView from "lottie-react-native";

// Data shape from your DB
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

type DiningItem = {
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

// Main categories & Payment methods
const mainCategories = ["Breakfast", "Lunch", "Dinner"];
const paymentMethods = [
  "Meal Swipes",
  "Cash",
  "Card",
  "Flex Dollars",
  "Employee Meal",
];

// The previous functions to create dates at noon are still here for reference,
// but we now want to use the full local date rather than forcing noon.
function createLocalNoonDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function createLocalNoonDateForToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

export default function DiningScreen() {
  const navigation = useNavigation();
  const { logout, username, firstname } = useAuth();
  const [diningData, setDiningData] = useState<DiningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [first_name, setFirstname] = useState("");

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState("Breakfast");
  const [selectedDiet, setSelectedDiet] = useState("All");
  // Instead of forcing the selected date to noon, we initialize it with the current date
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [timelineWidth, setTimelineWidth] = useState<number>(0);

  // ========== Fetch Data ==========
  useEffect(() => {
    const fetchDiningMenu = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("http://127.0.0.1:8081/Dining_Menu/");
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const data: DiningAPIItem[] = await response.json();
        const mapped = data.map((item) => {
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
        });
        setDiningData(mapped);
      } catch (err: any) {
        setError(err.message || "Error fetching dining menu");
      } finally {
        setLoading(false);
      }
    };
    fetchDiningMenu();
  }, []);

  // Update currentTime every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic Category Switch
  useEffect(() => {
    const hr = currentTime.getHours();
    const min = currentTime.getMinutes();
    const totalMinutes = hr * 60 + min;
    if (totalMinutes >= 7 * 60 && totalMinutes <= 12 * 60) {
      setSelectedCategory("Breakfast");
    } else if (totalMinutes >= 12 * 60 && totalMinutes <= 15 * 60 + 30) {
      setSelectedCategory("Lunch");
    } else if (totalMinutes >= 16 * 60 && totalMinutes <= 22 * 60) {
      setSelectedCategory("Dinner");
    }
  }, [currentTime]);

  // DateTimePicker Helpers: format date as YYYY-MM-DD for filtering
  function formatDateToYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const filterDateStr = formatDateToYMD(selectedDate);

  // --- Update Native Date Picker Handler ---
  // Instead of converting the date to noon, use the selected date as-is.
  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "web") {
      setShowDatePicker(false);
    }
    if (date) {
      console.log("New selected date (native):", date.toString());
      setSelectedDate(date);
    }
  };

  // --- Update Web Date Picker Handler ---
  // Parse the "YYYY-MM-DD" value manually, so it is created in local time.
  const handleWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month, day] = e.target.value.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    console.log("Web date selected (local):", localDate.toString());
    setSelectedDate(localDate);
  };

  // Filter Items
  const filteredItems = diningData.filter((item) => {
    const catMatch = item.mainCategory === selectedCategory;
    const dietMatch =
      selectedDiet === "All" ? true : item.diet === selectedDiet;
    const dateMatch = item.date === filterDateStr;
    return catMatch && dietMatch && dateMatch;
  });

  // Group by subcategory
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.subcategory]) {
      acc[item.subcategory] = [];
    }
    acc[item.subcategory].push(item);
    return acc;
  }, {} as Record<string, DiningItem[]>);

  // Timeline Calculation
  function getTimeFraction(d: Date): number {
    const hr = d.getHours();
    const min = d.getMinutes();
    return (hr * 60 + min) / (24 * 60);
  }
  const fraction = getTimeFraction(currentTime);
  const pointerLeft = fraction * timelineWidth;
  const elapsedWidth = pointerLeft;
  const remainingWidth = timelineWidth - pointerLeft;

  function formatCurrentTimeLabel(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const mm = String(minutes).padStart(2, "0");
    return `${hours}:${mm} ${ampm}`;
  }
  const currentTimeLabel = formatCurrentTimeLabel(currentTime);

  // ========== Payment Prompt Handlers ==========
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("");
  const [mnumber, setmnumber] = useState("");
  function handlePaymentMethodPress(method: string) {
    setSelectedPaymentMethod(method);
    setFirstname("");
    setmnumber("");
    setShowPaymentPrompt(true);
  }

  const simulatedtotal = 9.27;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/swipein_1.png")}
            style={styles.logo}
          />
          <Text style={styles.logoText}>Mesquite Dining Hall</Text>
        </View>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>Hi {firstname || "Guest"} !</Text>
        </View>
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              logout();
              navigation.navigate("Login" as never);
            }}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BANNER */}
      <View style={styles.bannerContainer}>
        <Text style={styles.bannerText}>What's On The Menu?</Text>
      </View>

      {/* MAIN + RIGHT columns */}
      <View style={{ flex: 1, flexDirection: "row", marginTop: 130 }}>
        {/* MAIN COLUMN (70%) */}
        <View style={[styles.mainColumn, { flex: 0.8 }]}>
          {/* Categories */}
          <View style={styles.topCard}>
            <View style={styles.categoriesRow}>
              {mainCategories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      isSelected && styles.categoryButtonSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        isSelected && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {cat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* TIMELINE + DATE ROW */}
          <View style={styles.timelineDateRow}>
            <View style={styles.timelineDarkBackground}>
              {/* TIME LABELS (white) */}
              <View style={styles.timelineLabelsRow}>
                <Text style={styles.timelineLabel}>12:00 AM</Text>
                <Text style={styles.timelineLabel}>06:00 AM</Text>
                <Text style={styles.timelineLabel}>12:00 PM</Text>
                <Text style={styles.timelineLabel}>06:00 PM</Text>
                <Text style={styles.timelineLabel}>12:00 AM</Text>
              </View>
              {/* The line itself: black portion vs. grey portion */}
              <View
                style={styles.timelineTrackContainer}
                onLayout={(e: LayoutChangeEvent) => {
                  const { width } = e.nativeEvent.layout;
                  setTimelineWidth(width);
                }}
              >
                {/* black portion from midnight to pointer */}
                <View
                  style={[styles.timelineElapsed, { width: elapsedWidth }]}
                />
                {/* grey portion after pointer */}
                <View
                  style={[
                    styles.timelineRemaining,
                    { left: elapsedWidth, width: remainingWidth },
                  ]}
                />
                {/* small circle knob on the line */}
                <View
                  style={[styles.pointerKnob, { left: pointerLeft - 5 }]}
                />
                {/* black bubble above it with white text */}
                <View
                  style={[styles.pointerBubble, { left: pointerLeft - 30 }]}
                >
                  <Text style={styles.pointerBubbleText}>
                    {formatCurrentTimeLabel(currentTime)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Date Picker */}
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Date</Text>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={formatDateToYMD(selectedDate)}
                  onChange={handleWebDateChange}
                  style={styles.dateInputWeb}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatDateToYMD(selectedDate)}
                    </Text>
                  </TouchableOpacity>
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
          </View>

          {/* Diet Filter */}
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Filter by Category:</Text>
            <Picker
              selectedValue={selectedDiet}
              style={styles.picker}
              onValueChange={(val) => setSelectedDiet(val)}
            >
              <Picker.Item label="All" value="All" />
              <Picker.Item label="Vegan" value="Vegan" />
              <Picker.Item label="Vegetarian" value="Vegetarian" />
              <Picker.Item label="Protein" value="Protein" />
            </Picker>
          </View>

          {/* Menu Items */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#007AFF"
              style={{ marginTop: 20 }}
            />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <ScrollView
              style={styles.menuScroll}
              showsVerticalScrollIndicator={false}
            >
              {Object.keys(groupedItems).length === 0 ? (
                <Text style={styles.noItemsText}>No items found.</Text>
              ) : (
                Object.keys(groupedItems).map((subcat) => (
                  <View key={subcat} style={styles.subcategorySection}>
                    <Text style={styles.subcategoryHeader}>{subcat}</Text>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderText, { flex: 2 }]}>
                        Menu Item
                      </Text>
                      <Text style={styles.tableHeaderText}></Text>
                      <Text style={styles.tableHeaderText}>Portion</Text>
                      <Text style={styles.tableHeaderText}>Calories</Text>
                    </View>
                    {groupedItems[subcat].map((item) => (
                      <View key={item.id} style={styles.tableRow}>
                        <View style={[styles.tableCell, { flex: 2 }]}>
                          <Text style={styles.menuItemTitle}>{item.title}</Text>
                        </View>
                        {item.diet ? (
                          <Text style={styles.dietText}>{item.diet} </Text>
                        ) : null}
                        <Text style={styles.tableCell}>
                          {item.portion || "N/A"}
                        </Text>
                        <Text style={styles.tableCell}>
                          {item.calories || 0} cal
                        </Text>
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>

        {/* RIGHT COLUMN (30%) */}
        <View style={[styles.rightColumn, { flex: 0.3 }]}>
          <Text style={styles.rightColumnHeader}>Payment Methods</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              onPress={() => handlePaymentMethodPress(method)}
              key={method}
              style={styles.paymentMethodItem}
            >
              <Text style={styles.paymentMethodText}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Payment Prompt Modal */}
      {showPaymentPrompt && (
        <PaymentPrompt
          visible={showPaymentPrompt}
          onClose={() => {
            setShowPaymentPrompt(false);
            setFirstname("");
            setmnumber("");
          }}
          method={selectedPaymentMethod}
          total={simulatedtotal.toString()}
          first_name={first_name}
          setFirstname={setFirstname}
          mnumber={mnumber}
          username={username || ""}
          setmnumber={setmnumber}
        />
      )}
    </View>
  );
}

// ----- PaymentPrompt Component -----
function PaymentPrompt({
  visible,
  onClose,
  method,
  username,
  total,
  first_name,
  setFirstname,
  mnumber,
  setmnumber,
}: {
  visible: boolean;
  onClose: () => void;
  method: string;
  total: string;
  first_name: string;
  setFirstname: (val: string) => void;
  mnumber: string;
  username: string;
  setmnumber: (val: string) => void;
}) {
  // For "Meal Swipes" or "Flex Dollars", ask for MNumber; else ask for First Name.
  const isMealPayment = method === "Meal Swipes" || method === "Flex Dollars";
  const isMeal_Swipe = method === "Meal Swipes";
  const isemployeeMeal = method === "Employee Meal";
  const finalTotal =
    method === "Meal Swipes" || method === "Employee Meal"
      ? 0.0
      : method === "Flex Dollars"
      ? 9.27
      : 10.0;
  const promptLabel = isMealPayment
    ? "Please enter your Mustang Number:"
    : "Please enter your First Name:";
  const [showSuccess, setShowSuccess] = useState(false);

  const handleStoreTransaction = async () => {
    if (method === "Meal Swipes" || method === "Flex Dollars") {
      try {
        // a) Check if MNumber exists
        const swipeRes = await fetch(`http://127.0.0.1:8081/swipe/${mnumber}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!swipeRes.ok) {
          window.alert("Mustang Number doesn't exist, please try again.");
          return;
        }

        const swipeData = await swipeRes.json();

        const paymentdata = {
          mnumber: mnumber,
          total: finalTotal,
          method: method,
        };
        const payRes = await fetch("http://127.0.0.1:8081/payments/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentdata),
        });

        if (method === "Meal Swipes") {
          if (swipeData.meal_swipes_left <= 0) {
            window.alert("You are out of swipes. Please recharge your swipes.");
            return;
          } else {
            payRes;
          }
        } else if (method === "Flex Dollars") {
          if (swipeData.flex_dollars_left < finalTotal) {
            window.alert("You do not have enough flex dollars. Please add more money.");
            return;
          } else {
            payRes;
          }
        }

        if (!payRes.ok) {
          window.alert("Error !! Payment failed.");
          return;
        }
      } catch (error: any) {
        window.alert("Error processing payment: " + error.message);
        return;
      }
    }

    const transactionData = {
      username: username,
      transaction_date: new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Chicago" })  // e.g. "2025-04-25 14:42:00"
      .replace(" ", "T"),
      transaction_mode: method,
      transaction_id: uuid.v4(),
      is_successful: true,
      Location: "Mesquite Dining Hall",
      Total_Amount: finalTotal,
      MNumber: mnumber,
      first_name: first_name,
    };

    try {
      const res = await fetch("http://127.0.0.1:8081/transaction/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });
      if (!res.ok) {
        throw new Error("Transaction DB insert failed");
      }
    } catch (error: any) {
      window.alert("Error storing transaction: " + error.message);
      return;
    }

    showSuccessAndClose();
  };

  function showSuccessAndClose() {
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      setmnumber("");
      setFirstname("");
      onClose();
    }, 1100);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {!showSuccess ? (
        <>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              <Text style={modalStyles.modalPromptLabel}>{promptLabel}</Text>
              <TextInput
                style={modalStyles.input}
                placeholder={isMealPayment ? " " : "Your First Name"}
                value={isMealPayment ? mnumber : first_name}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, "");
                  const formatted = "M" + cleaned.slice(0, 8);
                  isMealPayment ? setmnumber(formatted) : setFirstname(text);
                }}
                autoCapitalize={isMealPayment ? "none" : "words"}
              />
              {isMeal_Swipe || isemployeeMeal ? null : (
                <Text style={modalStyles.totalText}>Total: ${finalTotal}</Text>
              )}

              <View style={modalStyles.buttonRow}>
                <TouchableOpacity
                  style={modalStyles.modalCancelButton}
                  onPress={onClose}
                >
                  <Text style={modalStyles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={modalStyles.modalConfirmButton}
                  onPress={handleStoreTransaction}
                >
                  <Text style={modalStyles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.modalContainer2}>
          <View style={styles.alertBox}>
            <LottieView
              source={require("../../assets/images/Tick.json")}
              autoPlay
              loop={false}
              style={styles.animation}
            />
            <Text style={styles.text}>
              Payment Successful !! Thank you, {first_name || mnumber} !
            </Text>
          </View>
        </View>
      )}
    </Modal>
  );
}
