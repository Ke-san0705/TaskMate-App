const React = require('react');
const {
  NavigationContainer,
  createNavigationContainerRef
} = require('@react-navigation/native');
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
const { createNativeStackNavigator } = require('@react-navigation/native-stack');
const HomeScreen = require('../screens/HomeScreen');
const TasksScreen = require('../screens/TasksScreen');
const TaskEditScreen = require('../screens/TaskEditScreen');
const ProjectsScreen = require('../screens/ProjectsScreen');
const ProjectDetailScreen = require('../screens/ProjectDetailScreen');
const CharactersScreen = require('../screens/CharactersScreen');
const CharacterEditScreen = require('../screens/CharacterEditScreen');
const SettingsScreen = require('../screens/SettingsScreen');
const TaskMateNavIcon = require('../components/TaskMateNavIcon');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { colors, radius } = require('../theme/taskMateTheme');

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function icon(name) {
  return ({ color, focused }) => (
    <TaskMateNavIcon name={name} color={color} focused={focused} />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 74,
          paddingTop: 7,
          paddingBottom: 9,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopLeftRadius: radius.md,
          borderTopRightRadius: radius.md
        },
        tabBarLabelStyle: {
          marginTop: 2,
          fontSize: 12,
          fontWeight: '900'
        }
      }}
    >
      <Tab.Screen
        name={ROUTES.Home}
        component={HomeScreen}
        options={{ title: 'ホーム', tabBarIcon: icon('home') }}
      />
      <Tab.Screen
        name={ROUTES.Tasks}
        component={TasksScreen}
        options={{ title: 'タスク', tabBarIcon: icon('tasks') }}
      />
      <Tab.Screen
        name={ROUTES.Projects}
        component={ProjectsScreen}
        options={{ title: '長期', tabBarIcon: icon('projects') }}
      />
      <Tab.Screen
        name={ROUTES.Characters}
        component={CharactersScreen}
        options={{ title: 'キャラ', tabBarIcon: icon('characters') }}
      />
      <Tab.Screen
        name={ROUTES.Settings}
        component={SettingsScreen}
        options={{ title: '設定', tabBarIcon: icon('settings') }}
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
          name={ROUTES.ProjectDetail}
          component={ProjectDetailScreen}
          options={{ title: '長期プロジェクト' }}
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
