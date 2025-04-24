// components/StudentNavbar.tsx
import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { AuthContext } from '../AuthContext';

const tabs = [
  { label: 'Home',               path: '/Student',            icon: 'home-outline'       },
  { label: 'Trends',             path: '/Student/Trends',     icon: 'bar-chart-outline'  },
  { label: 'Menu',               path: '/Student/Location',   icon: 'location-outline'   },
  { label: 'Transaction History',path: '/Student/s_transaction',icon: 'time-outline'     },
] as const;

type UserProfile = {
  username:   string;
  first_name: string;
  last_name:  string;
  email:      string;
  password:   string;
};

export default function StudentNavbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const { username, logout } = useContext(AuthContext);
  const [ profileOpen, setProfileOpen ] = useState(false);
  const [ user, setUser ]               = useState<UserProfile | null>(null);

  // fetch full profile
  useEffect(() => {
    axios
      .get<UserProfile>(`http://127.0.0.1:8081/users/${username}`)
      .then(r => setUser(r.data))
      .catch(e => console.error(e));
  }, [username]);

  const isActive = (p?: string) => p === pathname;

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    router.push('/Login' as never);
  };

  const handleEdit = (field: keyof UserProfile) => {
    setProfileOpen(false);
    router.push({
      pathname: '/Student/edit_profile',
      params: { field },
    } as never);
  };

  // build our rows
  const rows: {
    label: string;
    value: string | undefined;
    key: keyof UserProfile;
    editable: boolean;
  }[] = [
    { label: 'Mustang ID',   value: user?.username,   key: 'username',   editable: false },
    { label: 'First Name',   value: user?.first_name, key: 'first_name', editable: true  },
    { label: 'Last Name',    value: user?.last_name,  key: 'last_name',  editable: true  },
    { label: 'Email',        value: user?.email,      key: 'email',      editable: true  },
    { label: 'Password',     value: '********',        key: 'password',   editable: true  },
  ];

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/images/swipein_1.png')} style={styles.logo} />

      <View style={styles.center}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tabs.map(tab => {
            const active = isActive(tab.path);
            return (
              <Pressable
                key={tab.label}
                onPress={() => tab.path && router.push(tab.path as never)}
                style={({ hovered, pressed }) => [
                  styles.tab,
                  active && styles.tabActive,
                  hovered && styles.tabHover,
                  pressed && styles.tabPressed,
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={20}
                  color={active ? '#005fa8' : '#555'}
                />
                <Text style={[styles.label, active && styles.labelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.userContainer}>
        <Pressable
          onPress={() => setProfileOpen(true)}
          style={({ hovered, pressed }) => [
            styles.userToggle,
            hovered && styles.userToggleHover,
            pressed && styles.userTogglePressed,
          ]}
        >
          <Ionicons name="person-circle-outline" size={28} color="#555" />
          <Text style={styles.userText}>
            Hi {user?.first_name ?? username}
          </Text>
        </Pressable>

        <Pressable onPress={handleLogout} style={styles.logoutIcon}>
          <Ionicons name="log-out-outline" size={24} color="#b00020" />
        </Pressable>
      </View>

      <Modal visible={profileOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setProfileOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Ionicons
                  name="person-circle-outline"
                  size={100}
                  color="#555"
                  style={{ marginBottom: 16 }}
                />

                {rows.map(({ label, value, key, editable }) => (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.profileLabel}>{label}:</Text>
                    <Text style={styles.profileValue}>{value}</Text>
                    {editable && (
                      <Pressable onPress={() => handleEdit(key)}>
                        <Ionicons name="pencil-outline" size={20} color="#005fa8" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <Pressable
                  style={[styles.closeBtn, { backgroundColor: '#b00020', marginTop: 20 }]}
                  onPress={handleLogout}
                >
                  <Text style={styles.closeText}>Logout</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 12,
  },
  logo: {
    width: 98,
    height: 98,
    resizeMode: 'contain',
    marginRight: 16,
  },
  center: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: 'rgba(202, 4, 4, 0.66)' },
  tabHover:  { backgroundColor: 'rgba(255, 0, 0, 0.66)' },
  tabPressed: { opacity: 0.6 },
  label: { marginLeft: 6, fontSize: 15, color: 'black' },
  labelActive: { color: 'white', fontWeight: '700' },

  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  userToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 10,
  },
  userToggleHover:  { backgroundColor: '#e0e0e0' },
  userTogglePressed: { opacity: 0.8 },
  userText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutIcon: {
    marginLeft: 10,
    padding: 6,
    borderRadius: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    justifyContent: 'center',
  },
  profileLabel: {
    fontSize: 16,
    color: '#555',
    marginRight: 8,
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: '#005fa8',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  closeText: { color: '#fff', fontSize: 16 },
});
