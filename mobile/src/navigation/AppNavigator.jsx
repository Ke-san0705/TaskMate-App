const React = require('react');
const { Text } = require('react-native');
const {
  NavigationContainer,
  createNavigationContainerRef
} = require('@react-navigation/native');
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
const { createNativeStackNavigator } = require('@react-navigation/native-stack');
const HomeScreen = require('../screens/HomeScreen');
const TasksScreen = require('../screens/TasksScreen');
const TaskEditScreen = require('../screens/TaskEditScreen');
const CharactersScreen = require('../screens/CharactersScreen');
const CharacterEditScreen = require('../screens/CharacterEditScreen');
const SettingsScreen = require('../screens/SettingsScreen');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function icon(label) {
  return ({ color }) => (
    <Text style={{ color, fontWeight: '900', fontSize: 16 }}>{label}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#315C3A',
        tabBarInactiveTintColor: '#6D786E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#D5DED3'
        },
        tabBarLabelStyle: {
          fontWeight: '800'
        }
      }}
    >
      <Tab.Screen
        name={ROUTES.Home}
        component={HomeScreen}
        options={{ title: 'ホーム', tabBarIcon: icon('家') }}
      />
      <Tab.Screen
        name={ROUTES.Tasks}
        component={TasksScreen}
        options={{ title: 'タスク', tabBarIcon: icon('予') }}
      />
      <Tab.Screen
        name={ROUTES.Characters}
        component={CharactersScreen}
        options={{ title: 'キャラ', tabBarIcon: icon('人') }}
      />
      <Tab.Screen
        name={ROUTES.Settings}
        component={SettingsScreen}
        options={{ title: '設定', tabBarIcon: icon('設') }}
      />
    </Tab.Navigator>
  );
}

function NotificationBridge() {
  const { consumeNotificationTask, notificationTaskId } = useTaskMate();
  React.useEffect(() => {
    if (!notificationTaskId || !navigationRef.isReady()) {
      return;
    }
    navigationRef.navigate(ROUTES.Tabs, {
      screen: ROUTES.Tasks,
      params: { highlightedTaskId: notificationTaskId }
    });
    consumeNotificationTask();
  }, [consumeNotificationTask, notificationTaskId]);
  return null;
}

function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <NotificationBridge />
      <Stack.Navigator>
        <Stack.Screen
          name={ROUTES.Tabs}
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={ROUTES.TaskEdit}
          component={TaskEditScreen}
          options={{ title: 'タスク' }}
        />
        <Stack.Screen
          name={ROUTES.CharacterEdit}
          component={CharacterEditScreen}
          options={{ title: 'キャラクター' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

module.exports = AppNavigator;
