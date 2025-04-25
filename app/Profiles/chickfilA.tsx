import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  mealStyles,
  modalStyles,
  styles,
  headerStyles,
  paymentPromptStyles,
} from "../styles/cfa";
import { cfaImages } from "../styles/cfa_images";
import uuid from "react-native-uuid";
import { useAuth } from "../AuthContext";
import LottieView from "lottie-react-native"; 

const cfaLogo = require("../../assets/images/CFA_Logo.svg");

type MenuAPIItem = {
  menu_id: number;
  item_title: string;
  item_description: string;
  calories: number;
  price: number;
  category_id: number;
};

type MenuItem = {
  id: number;
  name: string;
  description: string;
  calories: number;
  price: string;
  category: string;
  image: any;
};

type AddOnItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type CartItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
  addOns: AddOnItem[];
};

const categories = [
  "Entree",
  "Meal",
  "Sides",
  "Nuggets",
  "Deserts",
  "Drinks",
  "Sauces",
  "Additional Items",
];

const categoryMap: Record<number, string> = {
  4: "Entree",
  8: "Meal",
  1: "Sides",
  7: "Nuggets",
  2: "Deserts",
  3: "Drinks",
  5: "Sauces",
  6: "Additional Items",
};

const defaultImage = require("../../assets/images/swipee.jpg");

export default function ChickfilAScreen() {
  const navigation = useNavigation();
  const { logout, username, firstname } = useAuth();

  // Which category is selected
  const [selectedCategory, setSelectedCategory] = useState<string>("Entree");

  // Fetched menu data -> mapped to MenuItem
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  // Cart items on the right
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Additional item modals
  const [showEntreeSelectModal, setShowEntreeSelectModal] = useState(false);
  const [pendingAddOn, setPendingAddOn] = useState<MenuItem | null>(null);

  const [showAddOnsAfterEntree, setShowAddOnsAfterEntree] = useState(false);
  const [recentEntreeId, setRecentEntreeId] = useState<number | null>(null);

  const [showAddOnQuantityModal, setShowAddOnQuantityModal] = useState(false);
  const [addonQuantityInput, setAddonQuantityInput] = useState<string>("");
  const [selectedEntreeForQuantity, setSelectedEntreeForQuantity] =
    useState<CartItem | null>(null);
  const [selectedAddOnForQuantity, setSelectedAddOnForQuantity] =
    useState<MenuItem | null>(null);

  // Meal UI states
  const [mealEntree, setMealEntree] = useState<MenuItem | null>(null);
  const [mealSides, setMealSides] = useState<MenuItem | null>(null);
  const [mealSauces, setMealSauces] = useState<MenuItem | null>(null);
  const [mealDrinks, setMealDrinks] = useState<MenuItem | null>(null);

  const [mealPickTarget, setMealPickTarget] = useState<
    "entree" | "sides" | "sauces" | "drinks" | null
  >(null);
  const [showMealPickModal, setShowMealPickModal] = useState(false);

  // ========== Fetch Menu Data on Mount ==========
  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("http://127.0.0.1:8081/CFA_Menu/");
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data: MenuAPIItem[] = await response.json();

        const mapped = data.map((item) => {
          const priceString = `$${item.price.toFixed(2)}`;
          const catLabel = categoryMap[item.category_id] || "Additional Items";
          const foundImage = cfaImages[item.item_title] || defaultImage;

          return {
            id: item.menu_id,
            name: item.item_title,
            description: item.item_description,
            calories: item.calories,
            price: priceString,
            category: catLabel,
            image: foundImage,
          };
        });
        setMenuData(mapped);
      } catch (err: any) {
        setError(err.message || "Error fetching menu data");
      } finally {
        setLoading(false);
      }
    };
    fetchMenuData();
  }, []);

  // ========== Cart Logic ==========
  const handleClearAll = () => {
    setCartItems([]);
  };

  const addAddonToEntree = (
    entreeId: number,
    addOn: MenuItem,
    addOnQty: number
  ) => {
    const addOnPrice = parseFloat(addOn.price.replace("$", "")) || 0;
    setCartItems((prev) => {
      const newCart = [...prev];
      const eIndex = newCart.findIndex((ci) => ci.id === entreeId);
      if (eIndex === -1) return prev;

      const addOnIndex = newCart[eIndex].addOns.findIndex(
        (a) => a.id === addOn.id
      );
      if (addOnIndex > -1) {
        newCart[eIndex].addOns[addOnIndex].quantity += addOnQty;
      } else {
        newCart[eIndex].addOns.push({
          id: addOn.id,
          name: addOn.name,
          price: addOnPrice,
          quantity: addOnQty,
        });
      }
      return newCart;
    });
  };

  const checkAddOnQuantity = (entree: CartItem, addOn: MenuItem) => {

    if (entree.quantity === 1) {
      addAddonToEntree(entree.id, addOn, 1);
    } else {
      setSelectedEntreeForQuantity(entree);
      setSelectedAddOnForQuantity(addOn);
      setAddonQuantityInput("");
      setShowAddOnQuantityModal(true);
    }
  };

  const handleAddItem = (menuItem: MenuItem) => {
    const basePrice = parseFloat(menuItem.price.replace("$", "")) || 0;
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.id === menuItem.id && ci.category === menuItem.category
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        // If it’s an Entree, prompt for add-ons
        if (menuItem.category === "Entree") {
          setRecentEntreeId(menuItem.id);
          setShowAddOnsAfterEntree(true);
        }
        return updated;
      }
      // If new to cart
      const newItem: CartItem = {
        id: menuItem.id,
        name: menuItem.name,
        category: menuItem.category,
        price: basePrice,
        quantity: 1,
        addOns: [],
      };
      if (menuItem.category === "Entree") {
        setRecentEntreeId(menuItem.id);
        setShowAddOnsAfterEntree(true);
      }
      return [...prev, newItem];
    });
  };

  const handleRemoveItem = (itemId: number) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((c) => c.id === itemId);
      if (idx === -1) return prev;
      const copy = [...prev];
      if (copy[idx].quantity > 1) {
        copy[idx].quantity -= 1;
      } else {
        copy.splice(idx, 1);
      }
      return copy;
    });
  };

  const handleAddAdditionalItem = (menuItem: MenuItem) => {
    // Ensure at least one entree is in the cart
    const entrees = cartItems.filter((c) => c.category === "Entree");
    if (entrees.length === 0) {
      window.alert("No Entree, Please add an entree before extras.");
      return;
    }
    // If only one entree, skip the “select entree” modal
    if (entrees.length === 1) {
      checkAddOnQuantity(entrees[0], menuItem);
    } else {
      // Show a modal to pick *which* entree
      setPendingAddOn(menuItem);
      setShowEntreeSelectModal(true);
    }
  };

  const handleChooseEntreeForAddOn = (entreeId: number) => {
    const foundEntree = cartItems.find(
      (c) => c.id === entreeId && c.category === "Entree"
    );
    if (!foundEntree || !pendingAddOn) {
      setShowEntreeSelectModal(false);
      setPendingAddOn(null);
      return;
    }
    setShowEntreeSelectModal(false);
    checkAddOnQuantity(foundEntree, pendingAddOn);
    setPendingAddOn(null);
  };

  const handleConfirmAddOnQuantity = () => {
    if (!selectedEntreeForQuantity || !selectedAddOnForQuantity) {
      setShowAddOnQuantityModal(false);
      return;
    }
    const q = parseInt(addonQuantityInput, 10);
    if (
      isNaN(q) ||
      q < 1 ||
      q > selectedEntreeForQuantity.quantity
    ) {
      window.alert(
        `Invalid quantity. Please enter an integer between 1 and ${selectedEntreeForQuantity.quantity}.`
      );
      return;
    }
    addAddonToEntree(selectedEntreeForQuantity.id, selectedAddOnForQuantity, q);
    setShowAddOnQuantityModal(false);
    setSelectedEntreeForQuantity(null);
    setSelectedAddOnForQuantity(null);
    setAddonQuantityInput("");
  };

  const additionalItems = menuData.filter(
    (m) => m.category === "Additional Items"
  );

  const handlePickAddOnPostEntree = (addOn: MenuItem) => {
    const foundEntree = cartItems.find((c) => c.id === recentEntreeId);
    if (!foundEntree) {
      window.alert("No matching entree found.");
      return;
    }
    checkAddOnQuantity(foundEntree, addOn);
  };

  const handleCloseAddOnsModal = () => {
    setShowAddOnsAfterEntree(false);
    setRecentEntreeId(null);
  };

  const handleRemoveAddOn = (entreeId: number, addOnId: number) => {
    setCartItems((prev) => {
      const newCart = [...prev];
      const entreeIndex = newCart.findIndex((ci) => ci.id === entreeId);
      if (entreeIndex === -1) return prev;
      const aoIndex = newCart[entreeIndex].addOns.findIndex(
        (a) => a.id === addOnId
      );
      if (aoIndex === -1) return prev;

      if (newCart[entreeIndex].addOns[aoIndex].quantity > 1) {
        newCart[entreeIndex].addOns[aoIndex].quantity -= 1;
      } else {
        newCart[entreeIndex].addOns.splice(aoIndex, 1);
      }
      return newCart;
    });
  };

  // ========== Calculate total ==========
  const calculateTotal = () => {
    let baseTotal = 0;
    let sauceCount = 0;
    for (const cItem of cartItems) {
      baseTotal += cItem.price * cItem.quantity;
      for (const addOn of cItem.addOns) {
        baseTotal += addOn.price * addOn.quantity;
      }
      if (cItem.category === "Sauces") {
        sauceCount += cItem.quantity;
      }
    }
    let surcharge = 0;
    if (sauceCount > 2) {
      surcharge = (sauceCount - 2) * 0.25;
    }
    return (baseTotal + surcharge).toFixed(2);
  };

  // ========== Meal UI ==========
  const allMealItemsChosen =
    mealEntree && mealSides && mealSauces && mealDrinks;

  const handleMealCardPress = (
    target: "entree" | "sides" | "sauces" | "drinks"
  ) => {
    setMealPickTarget(target);
    setShowMealPickModal(true);
  };

  const getMealPickList = () => {
    if (!mealPickTarget) return [];
    switch (mealPickTarget) {
      case "entree":
        return menuData.filter(
          (m) => m.category === "Entree" || m.category === "Nuggets"
        );
      case "sides":
        return menuData.filter((m) => m.category === "Sides");
      case "sauces":
        return menuData.filter((m) => m.category === "Sauces");
      case "drinks":
        return menuData.filter((m) => m.category === "Drinks");
      default:
        return [];
    }
  };

  const handleSelectMealItem = (item: MenuItem) => {
    if (mealPickTarget === "entree") setMealEntree(item);
    if (mealPickTarget === "sides") setMealSides(item);
    if (mealPickTarget === "sauces") setMealSauces(item);
    if (mealPickTarget === "drinks") setMealDrinks(item);

    setShowMealPickModal(false);
    setMealPickTarget(null);
  };

  const handleAddMealToCart = () => {
    if (!mealEntree || !mealSides || !mealSauces || !mealDrinks) return;
    const itemsToAdd = [mealEntree, mealSides, mealSauces, mealDrinks];

    setCartItems((prev) => {
      const newCart = [...prev];
      itemsToAdd.forEach((item) => {
        const basePrice = parseFloat(item.price.replace("$", "")) || 0;
        const existingIndex = newCart.findIndex((ci) => ci.id === item.id);
        if (existingIndex > -1) {
          newCart[existingIndex].quantity += 1;
        } else {
          newCart.push({
            id: item.id,
            name: item.name,
            category: item.category,
            price: basePrice,
            quantity: 1,
            addOns: [],
          });
        }
      });
      return newCart;
    });

    setMealEntree(null);
    setMealSides(null);
    setMealSauces(null);
    setMealDrinks(null);
    window.alert("Meal items have been added to your cart!");
  };

  const renderMealUI = () => {
    return (
      <View style={{ flexDirection: "column", padding: 16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Entree */}
          <View style={mealStyles.mealCard}>
            <TouchableOpacity
              style={mealStyles.plusButton}
              onPress={() => handleMealCardPress("entree")}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
            <Text style={mealStyles.mealCardTitle}>Entree</Text>
            {mealEntree ? (
              <>
                <Image
                  source={mealEntree.image}
                  style={mealStyles.mealImage}
                  resizeMode="cover"
                />
                <Text style={mealStyles.mealItemName}>{mealEntree.name}</Text>
                <Text style={mealStyles.mealItemName}>{mealEntree.price}</Text>
              </>
            ) : (
              <Text style={mealStyles.mealItemName}>No Entree Selected</Text>
            )}
          </View>

          {/* Sides */}
          <View style={mealStyles.mealCard}>
            <TouchableOpacity
              style={mealStyles.plusButton}
              onPress={() => handleMealCardPress("sides")}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
            <Text style={mealStyles.mealCardTitle}>Sides</Text>
            {mealSides ? (
              <>
                <Image
                  source={mealSides.image}
                  style={mealStyles.mealImage}
                  resizeMode="cover"
                />
                <Text style={mealStyles.mealItemName}>{mealSides.name}</Text>
                <Text style={mealStyles.mealItemName}>{mealSides.price}</Text>
              </>
            ) : (
              <Text style={mealStyles.mealItemName}>No Side Selected</Text>
            )}
          </View>

          {/* Sauces */}
          <View style={mealStyles.mealCard}>
            <TouchableOpacity
              style={mealStyles.plusButton}
              onPress={() => handleMealCardPress("sauces")}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
            <Text style={mealStyles.mealCardTitle}>Sauces</Text>
            {mealSauces ? (
              <>
                <Image
                  source={mealSauces.image}
                  style={mealStyles.mealImage}
                  resizeMode="cover"
                />
                <Text style={mealStyles.mealItemName}>{mealSauces.name}</Text>
                <Text style={mealStyles.mealItemName}>{mealSauces.price}</Text>
              </>
            ) : (
              <Text style={mealStyles.mealItemName}>No Sauce Selected</Text>
            )}
          </View>

          {/* Drinks */}
          <View style={mealStyles.mealCard}>
            <TouchableOpacity
              style={mealStyles.plusButton}
              onPress={() => handleMealCardPress("drinks")}
            >
              <Text style={{ color: "#fff", fontSize: 20 }}>+</Text>
            </TouchableOpacity>
            <Text style={mealStyles.mealCardTitle}>Drinks</Text>
            {mealDrinks ? (
              <>
                <Image
                  source={mealDrinks.image}
                  style={mealStyles.mealImage}
                  resizeMode="cover"
                />
                <Text style={mealStyles.mealItemName}>{mealDrinks.name}</Text>
                <Text style={mealStyles.mealItemName}>{mealDrinks.price}</Text>
              </>
            ) : (
              <Text style={mealStyles.mealItemName}>No Drink Selected</Text>
            )}
          </View>
        </ScrollView>

        {allMealItemsChosen && (
          <TouchableOpacity
            style={mealStyles.addMealButton}
            onPress={handleAddMealToCart}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              Add Meal to Cart
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Payment Prompt
  const handleOpenPaymentPrompt = () => {
    if (cartItems.length === 0) return;
    setShowPaymentModal(true);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={headerStyles.header}>
        <Image source={cfaLogo} style={headerStyles.logo} resizeMode="contain" />
        <Text style={headerStyles.greeting}>Hi {firstname || "Guest"} !</Text>
        <TouchableOpacity
          style={headerStyles.logoutButton}
          onPress={async () => {
            await logout();
            navigation.navigate("Login" as never);
          }}
        >
          <Text style={headerStyles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Left Nav */}
        <ScrollView
          style={styles.navColumn}
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.navItem,
                selectedCategory === cat && styles.selectedNavItem,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={styles.navText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Middle Content */}
        <View style={styles.menuContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : error ? (
            <Text style={{ color: "red", padding: 10 }}>{error}</Text>
          ) : selectedCategory === "Meal" ? (
            renderMealUI()
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.menuGrid}
            >
              {menuData
                .filter((item) => item.category === selectedCategory)
                .map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    onPress={() => handleAddItem(item)}
                  >
                    <Image
                      source={item.image}
                      style={styles.itemImage}
                      resizeMode="contain"
                    />
                    <View style={styles.textContainer}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.calories}>{item.calories} Cal</Text>
                    </View>
                    <View style={styles.bottomRow}>
                      <Text style={styles.price}>{item.price}</Text>
                      <TouchableOpacity
                        style={styles.orderButton}
                        onPress={() => handleAddItem(item)}
                      >
                        <Text style={styles.buttonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}
        </View>

        {/* Cart */}
        <View style={styles.cartContainer}>
          <Text style={styles.cartHeader}>Your Cart</Text>

          <ScrollView
            style={styles.cartItems}
            showsHorizontalScrollIndicator={false}
          >
            {cartItems.length === 0 ? (
              <Text style={styles.emptyCart}>Your cart is empty</Text>
            ) : (
              cartItems.map((cItem) => (
                <View key={cItem.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{cItem.name}</Text>
                    <Text style={styles.cartItemPrice}>
                      {cItem.quantity} x ${cItem.price.toFixed(2)}
                    </Text>
                    {/* Add-ons */}
                    {cItem.addOns.length > 0 && (
                      <View style={{ marginLeft: 10 }}>
                        {cItem.addOns.map((ao) => (
                          <View
                            key={ao.id}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ fontSize: 13 }}>
                              + {ao.name} (x{ao.quantity}) = $
                              {(ao.price * ao.quantity).toFixed(2)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemoveAddOn(cItem.id, ao.id)}
                            >
                              <Text style={{ color: "red", marginLeft: 8 }}>
                                x
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveItem(cItem.id)}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {cartItems.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAll}
                style={{ marginTop: 20 }}
              >
                <Text style={{ color: "red", fontWeight: "600" }}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>Total: ${calculateTotal()}</Text>
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={handleOpenPaymentPrompt}
              disabled={cartItems.length === 0}
            >
              <Text style={styles.paymentButtonText}>Proceed to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========== ENTREE SELECT MODAL ========== */}
        <Modal
          visible={showEntreeSelectModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEntreeSelectModal(false)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              <Text style={{ fontWeight: "bold", marginBottom: 15 }}>
                Select an Entree:
              </Text>
              {cartItems
                .filter((c) => c.category === "Entree")
                .map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={{ paddingVertical: 8 }}
                    onPress={() => handleChooseEntreeForAddOn(c.id)}
                  >
                    <Text>
                      {c.name} (Qty: {c.quantity})
                    </Text>
                  </TouchableOpacity>
                ))}
              <TouchableOpacity
                style={{ marginTop: 12, alignSelf: "flex-end" }}
                onPress={() => {
                  setShowEntreeSelectModal(false);
                  setPendingAddOn(null);
                }}
              >
                <Text style={{ color: "red", fontWeight: "bold", padding: 18 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ========== SHOW ADD-ONS AFTER ENTREE MODAL ========== */}
        <Modal
          visible={showAddOnsAfterEntree}
          transparent
          animationType="fade"
          onRequestClose={handleCloseAddOnsModal}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              <Text style={{ fontWeight: "bold", marginBottom: 12 }}>
                Add-ons for your entree?
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {additionalItems.map((addOn) => (
                  <TouchableOpacity
                    key={addOn.id}
                    style={{ paddingVertical: 8 }}
                    onPress={() => handlePickAddOnPostEntree(addOn)}
                  >
                    <Text>
                      {addOn.name} - {addOn.price}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={{ marginTop: 12, alignSelf: "flex-end" }}
                onPress={handleCloseAddOnsModal}
              >
                <Text style={{ color: "red", fontWeight: "bold", padding: 18 }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ========== ADD-ON QUANTITY MODAL ========== */}
        <Modal
          visible={showAddOnQuantityModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddOnQuantityModal(false)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              {selectedEntreeForQuantity && selectedAddOnForQuantity ? (
                <>
                  <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                    {`How many of ${selectedEntreeForQuantity.name} (Qty: ${selectedEntreeForQuantity.quantity}) should get ${selectedAddOnForQuantity.name}?`}
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    style={modalStyles.input}
                    placeholder={`1 to ${selectedEntreeForQuantity.quantity}`}
                    value={addonQuantityInput}
                    onChangeText={setAddonQuantityInput}
                  />
                  <View
                    style={{ flexDirection: "row", justifyContent: "flex-end" }}
                  >
                    <TouchableOpacity
                      style={{ marginRight: 16 }}
                      onPress={() => setShowAddOnQuantityModal(false)}
                    >
                      <Text
                        style={{
                          color: "red",
                          fontWeight: "bold",
                          padding: 18,
                        }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleConfirmAddOnQuantity}>
                      <Text
                        style={{
                          color: "green",
                          fontWeight: "bold",
                          padding: 18,
                        }}
                      >
                        Confirm
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text>Invalid state. Please close.</Text>
              )}
            </View>
          </View>
        </Modal>

        {/* ========== MEAL PICK MODAL ========== */}
        <Modal
          visible={showMealPickModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMealPickModal(false)}
        >
          <View style={modalStyles.overlay}>
            <View style={modalStyles.modalContainer}>
              <Text style={{ fontWeight: "bold", marginBottom: 8 }}>
                Select an Item
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {getMealPickList().map((mItem) => (
                  <TouchableOpacity
                    key={mItem.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 18,
                    }}
                    onPress={() => handleSelectMealItem(mItem)}
                  >
                    <Image
                      source={mItem.image}
                      style={{ width: 40, height: 40, marginRight: 8 }}
                      resizeMode="cover"
                    />
                    <View>
                      <Text style={{ fontWeight: "500" }}>{mItem.name}</Text>
                      <Text style={{ color: "#666" }}>{mItem.price}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={{ marginTop: 12, alignSelf: "flex-end" }}
                onPress={() => setShowMealPickModal(false)}
              >
                <Text style={{ color: "red", fontWeight: "bold", padding: 18 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ========= CUSTOM PAYMENT PROMPT ========= */}
        <PaymentPrompt
          visible={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          total={calculateTotal()}
          username={username || ""}
          setCartItems={setCartItems}
        />
      </View>
    </View>
  );
}

// ===================== PaymentPrompt (Updated) =====================
function PaymentPrompt({
  visible,
  onClose,
  username,
  total,
  setCartItems,
}: {
  visible: boolean;
  onClose: () => void;
  total: string;
  username: string;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
}) {
  const [first_name, setFirstname] = useState("");
  const [mnumber, setmnumber] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const totalNum = parseFloat(total);

  // STEP 1: Payment Method Selection
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const mealSwipesDisabled = totalNum > 9.27;


  const handleClose = () => {
    setShowSuccess(false);
    setSelectedMethod(null);
    setFirstname("");
    setmnumber("");
    onClose();
  };

// =========== Step 2 Confirm Payment ===========
const handleConfirmPayment = async () => {
  // Basic validation

  if (selectedMethod === "Meal Swipes" || selectedMethod === "Flex Dollars") {
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
  
      // b) Verify meal swipes or flex balance
      
      // c) Deduct: POST /payments/
      const paymentdata = {
        mnumber: mnumber,
        total: totalNum,
        method: selectedMethod,
      };
      const payRes = await fetch("http://127.0.0.1:8081/payments/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentdata),
      });


      if (selectedMethod === "Meal Swipes") 
        {
        if (swipeData.meal_swipes_left <= 0)
          {
            window.alert("You are out of swipes. Please recharge your swipes.");
            return;
          }

          else
          {
            payRes
          }
        
        
      } else if (selectedMethod === "Flex Dollars") {
        if (swipeData.flex_dollars_left < totalNum) {
          window.alert("You do not have enough flex dollars. Please add more money.");
          return;
        }

        else 
        {
          payRes
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
  
  // 2) Now that we’ve passed the checks (or if Cash/Card was chosen):
  //    INSERT the transaction record into /transaction/
  const chargeAmount = selectedMethod === "Meal Swipes"
  ? 0.00
  : totalNum;



  const transactionData = {
    username: username,
    transaction_date: new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Chicago" }) 
    .replace(" ", "T"),
    transaction_mode: selectedMethod,
    transaction_id: uuid.v4(),
    is_successful: true,
    Location: "Chick-fil-A",
    Total_Amount: chargeAmount,
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
  

  showSuccessAnimation();

};

function showSuccessAnimation() {
  setShowSuccess(true);
  setTimeout(() => {
    setShowSuccess(false);
    setCartItems([]);
    setSelectedMethod(null);
    setFirstname("");
    setmnumber("");
    onClose();
  }, 1200);
}

// =========== Rendering the Modal Content ===========
return (
    <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={handleClose}
  >
    {!showSuccess ? (
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modalContainer}>
          {/* STEP 1: Payment Method not selected => Show Payment Buttons */}
          {!selectedMethod ? (
            <>
              <Text
                style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
              >
                Payment Methods
              </Text>

              <Text style={{ fontSize: 16, marginBottom: 20 }}>
                Total: $
                <Text style={{ fontWeight: "bold", color: "#f60505" }}>
                  {total}
                </Text>
              </Text>

              {/* Four Buttons */}
              <View style={paymentPromptStyles.paymentOptionsContainer}>
                <TouchableOpacity
                  style={[
                    paymentPromptStyles.paymentOption,
                    mealSwipesDisabled && { backgroundColor: "#ccc" },
                  ]}
                  disabled={mealSwipesDisabled}
                  onPress={() => setSelectedMethod("Meal Swipes")}
                >
                  <Text
                    style={{
                      color: mealSwipesDisabled ? "#999" : "#fff",
                    }}
                  >
                    Meal Swipes
                    {mealSwipesDisabled ? " (Over $9.27)" : ""}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={paymentPromptStyles.paymentOption}
                  onPress={() => setSelectedMethod("Flex Dollars")}
                >
                  <Text style={{ color: "#fff" }}>Flex Dollars</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={paymentPromptStyles.paymentOption}
                  onPress={() => setSelectedMethod("Cash")}
                >
                  <Text style={{ color: "#fff" }}>Cash</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={paymentPromptStyles.paymentOption}
                  onPress={() => setSelectedMethod("Card")}
                >
                  <Text style={{ color: "#fff" }}>Card</Text>
                </TouchableOpacity>
              </View>

              {/* Cancel */}
              <TouchableOpacity
                style={{ marginTop: 14, alignSelf: "flex-end" }}
                onPress={handleClose}
              >
                <Text style={{ color: "red", fontWeight: "bold", padding: 10 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* STEP 2: Payment Method chosen => Show appropriate inputs */
            <>
              <Text
                style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
              >
                {selectedMethod}
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Total: $
                <Text style={{ fontWeight: "bold", color: "#f60505" }}>
                  {total}
                </Text>
              </Text>

              {/* If Meal Swipes / Flex => ask MNumber; else ask first name */}
              {selectedMethod === "Meal Swipes" ||
              selectedMethod === "Flex Dollars" ? (
                <>
                  <Text style={{ marginBottom: 4 }}>Enter MNumber:</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 12 }]}
                    placeholder="e.g. M12345678"
                    value={mnumber}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9]/g, "");
                      const formatted = "M" + cleaned.slice(0, 8);
                      setmnumber(formatted);
                    }}
                    maxLength={9}
                    autoCapitalize="none"
                  />
                </>
              ) : (
                <>
                  <Text style={{ marginBottom: 4 }}>Enter First Name:</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 12 }]}
                    placeholder="Your First Name"
                    value={first_name}
                    onChangeText={setFirstname}
                    autoCapitalize="words"
                  />
                </>
              )}

              {/* Confirm & Cancel */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <TouchableOpacity
                  style={{ marginRight: 18 }}
                  onPress={() => setSelectedMethod(null)}
                >
                  <Text style={{ color: "red", fontWeight: "bold" }}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleConfirmPayment}>
                  <Text style={{ color: "green", fontWeight: "bold" }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    ) : (
      /* Success Animation */
      <View style={modalStyles.overlay}>
        <View style={modalStyles.modalContainer}>
          <LottieView
            source={require("../../assets/images/Tick.json")}
            autoPlay
            loop={false}
            style={{ width: 150, height: 150 }}
          />
          <Text style={{ fontSize: 16, fontWeight: "bold", marginTop: 12 }}>
          Payment Successful !! Thank you, {first_name || mnumber} !
          </Text>
        </View>
      </View>
    )}
  </Modal>
  );
}
