import { View, Text, StyleSheet } from 'react-native';

export default function Machine() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Machine Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text:      { color: '#fff', fontSize: 18 },
});
