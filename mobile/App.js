const React = require('react');
const { ActivityIndicator, StyleSheet, Text, View } = require('react-native');
const { StatusBar } = require('expo-status-bar');
const { SafeAreaProvider } = require('react-native-safe-area-context');
const AppNavigator = require('./src/navigation/AppNavigator');
const { TaskMateProvider, useTaskMate } = require('./src/context/TaskMateContext');

function AppContent() {
  const { loading } = useTaskMate();
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#315C3A" size="large" />
        <Text style={styles.loadingText}>TaskMateを準備しています...</Text>
      </View>
    );
  }
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TaskMateProvider>
        <StatusBar style="dark" />
        <AppContent />
      </TaskMateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#EEF5EA'
  },
  loadingText: {
    color: '#315C3A',
    fontWeight: '800'
  }
});
