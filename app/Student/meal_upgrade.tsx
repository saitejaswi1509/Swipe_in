import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import axios from 'axios';
import { AuthContext } from '../AuthContext';

// 👇 point all axios calls to your FastAPI server
axios.defaults.baseURL = 'http://127.0.0.1:8081';

type PlanKey = 'Platinum' | 'Gold' | 'Silver' | 'Bronze';

const PLAN_PRICES: Record<PlanKey, number> = {
  Platinum: 2263,
  Gold:     2036,
  Silver:   1792,
  Bronze:    958,
};
const PLAN_SWIPES: Record<PlanKey, number> = {
  Platinum: 600,
  Gold:     200,
  Silver:   150,
  Bronze:    75,
};
const PLAN_LABELS: Record<PlanKey, { price: string; swipes: string }> = {
  Platinum: { price: '$2,263 / semester', swipes: 'Unlimited Swipes + $100 Flex Dollars' },
  Gold:     { price: '$2,036 / semester', swipes: '200 Swipes + $100 Flex Dollars' },
  Silver:   { price: '$1,792 / semester', swipes: '150 Swipes + $100 Flex Dollars' },
  Bronze:   { price: '$958 / semester',  swipes: '75 Swipes + $100 Flex Dollars' },
};

export default function StudentUpgradePlan() {
  const { username } = useContext(AuthContext);

  const [profile, setProfile]         = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanKey | null>(null);
  const [loading, setLoading]         = useState(true);
  const [updating, setUpdating]       = useState<PlanKey | null>(null);

  // ── FIXED useEffect ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1) Load user profile (should never 404 if they exist)
      try {
        const userRes = await axios.get<{
          first_name: string;
          last_name:  string;
          email:      string;
        }>(`/users/${username}`);
        setProfile(userRes.data);
      } catch (err: any) {
        console.error('Profile load error:', err.response?.status, err.response?.data);
        Alert.alert('Error', 'Could not load your profile.');
        setLoading(false);
        return;
      }

      // 2) Load meal plan; if 404, treat as “no plan yet”
      try {
        const planRes = await axios.get<{ meal_plan: PlanKey }>(`/meal_plan/${username}`);
        setCurrentPlan(planRes.data.meal_plan);
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No existing plan → allow registration
          setCurrentPlan(null);
        } else {
          console.error('Plan load error:', err.response?.status, err.response?.data);
          Alert.alert('Error', 'Could not load your meal plan.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);
  // ── END FIX ────────────────────────────────────────────────────────

  const changePlan = (newPlan: PlanKey) => {
    if (!profile) {
      return Alert.alert('Error', 'Profile not loaded yet.');
    }
    setUpdating(newPlan);

    const isFirstPurchase = currentPlan === null;
    const url   = isFirstPurchase
      ? '/student/registration/'
      : `/student_users_upgrade/${username}`;
    const body  = isFirstPurchase
      ? {
          username,
          first_name: profile.first_name,
          last_name:  profile.last_name,
          email:      profile.email,
          meal_plan:  newPlan,
        }
      : { meal_plan: newPlan };

    axios({
      method: isFirstPurchase ? 'post' : 'put',
      url,
      data: body,
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => {
        setCurrentPlan(newPlan);
        Alert.alert(
          'Success',
          isFirstPurchase
            ? `Registered & purchased ${newPlan}!`
            : `Upgraded to ${newPlan}!`
        );
      })
      .catch((err: any) => {
        console.error('Submit error:', err.response?.status, err.response?.data);
        const msg =
          err.response?.data?.detail ??
          JSON.stringify(err.response?.data) ??
          err.message;
        Alert.alert('Error', msg);
      })
      .finally(() => setUpdating(null));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isFirstPurchase = currentPlan === null;
  const currentCost     = currentPlan ? PLAN_PRICES[currentPlan] : 0;
  const currentSwipes   = currentPlan ? PLAN_SWIPES[currentPlan] : 0;
  const ordered: PlanKey[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>
        {isFirstPurchase ? 'Choose Your Meal Plan' : "Let's Upgrade Your Meal Plan"}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.planRow}
      >
        {ordered.map(plan => {
          const cost       = PLAN_PRICES[plan];
          const swipes     = PLAN_SWIPES[plan];
          const isCurrent  = plan === currentPlan;
          const isDisabled = currentPlan ? cost <= currentCost : false;
          const isUpdating = updating === plan;
          const extraCost   = Math.max(cost - currentCost, 0);
          const extraSwipes = Math.max(swipes - currentSwipes, 0);

          return (
            <View
              key={plan}
              style={[styles.card, isDisabled && styles.cardDisabled]}
              pointerEvents={isDisabled ? 'none' : 'auto'}
            >
              <Text style={styles.planName}>{plan.toUpperCase()}</Text>
              <Text style={styles.price}>{PLAN_LABELS[plan].price}</Text>
              <Text style={styles.swipes}>{PLAN_LABELS[plan].swipes}</Text>

              {isCurrent && !isFirstPurchase && (
                <Text style={styles.currentBadge}>CURRENT PLAN</Text>
              )}

              {!isCurrent && currentPlan && cost > currentCost && (
                <>
                  <Text style={styles.extra}>+${extraCost} to upgrade</Text>
                  <Text style={styles.extraSwipes}>+{extraSwipes} swipes</Text>
                  <Text style={styles.extraFlex}>+$100 Flex Dollars</Text>
                </>
              )}

              <Pressable
                disabled={isDisabled || !!isUpdating}
                onPress={() => changePlan(plan)}
                style={({ hovered, pressed }) => [
                  styles.button,
                  (isDisabled || isCurrent) && styles.buttonDisabled,
                  hovered && !isDisabled && styles.buttonHover,
                  pressed && !isDisabled && styles.buttonPressed,
                ]}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      (isDisabled || isCurrent) && styles.buttonTextDisabled
                    ]}
                  >
                    {isCurrent && !isFirstPurchase
                      ? 'CURRENT'
                      : isFirstPurchase
                        ? `Buy $${cost}`
                        : `Upgrade +$${extraCost}`}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    marginTop: 100,
    fontSize: 45,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 100,
    color: '#B22222',
  },
  planRow: { paddingHorizontal: 16, alignItems: 'flex-start' },
  card: {
    width: 340,
    minHeight: 240,
    backgroundColor: '#F0D9D9',
    borderRadius: 24,
    padding: 30,
    marginRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    marginLeft: 36,
  },
  cardDisabled: { opacity: 0.5, backgroundColor: '#E0E0E0' },
  planName: { fontSize: 24, fontWeight: '700', color: '#B22222', marginBottom: 18, textAlign: 'center' },
  price: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  swipes: { fontSize: 16, marginBottom: 12, color: '#333' },
  extra: { fontSize: 14, color: '#C44', fontWeight: '600' },
  extraSwipes: { fontSize: 14, color: '#C44', fontWeight: '600' },
  extraFlex: { fontSize: 14, color: '#C44', fontWeight: '600', marginBottom: 12 },
  currentBadge: { fontSize: 14, fontWeight: '700', color: '#005fa8', marginBottom: 12, marginTop: 10 },
  button: { marginTop: 20, backgroundColor: '#B22222', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#777' },
  buttonHover: { backgroundColor: '#C33' },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonTextDisabled: { color: '#ddd' },
});
