import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#000', borderTopColor: '#1a1a1a' },
        tabBarActiveTintColor: '#CB2027',
        tabBarInactiveTintColor: '#626362',
      }}
    >
      <Tabs.Screen name="analyze"   options={{ title: 'Analyze' }} />
      <Tabs.Screen name="machine"   options={{ title: 'Machine' }} />
      <Tabs.Screen name="progress"  options={{ title: 'Progress' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
    </Tabs>
  );
}
