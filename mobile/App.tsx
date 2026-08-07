import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AuthError,
  addIssueUpdate,
  createIssue,
  isAuthError,
  deleteCurrentAccount,
  getFeedTicket,
  getDashboardWeatherForecast,
  listActionItems,
  listFeedTickets,
  listOperationsCalendar,
  getPlacementDay,
  getProfile,
  getWeightEntry,
  listPlacements,
  login,
  markChicksArrived,
  requestPasswordReset,
  submitFeedTicket,
  submitPlacementDay,
  submitWeightEntry,
} from "./src/api/http";
import { DashboardScreen, DeleteAccountModal } from "./src/screens/DashboardScreen";
import { ActionItemsScreen } from "./src/screens/ActionItemsScreen";
import { FeedTicketListScreen } from "./src/screens/FeedTicketListScreen";
import { FeedTicketScreen } from "./src/screens/FeedTicketScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OperationsCalendarScreen } from "./src/screens/OperationsCalendarScreen";
import { PlacementDayScreen } from "./src/screens/PlacementDayScreen";
import { WeightEntryScreen } from "./src/screens/WeightEntryScreen";
import {
  clearStoredSession,
  loadStoredSession,
  persistSession,
} from "./src/storage/session";
import {
  ActionItemWorkOrder,
  AuthSession,
  DashboardSettings,
  DashboardWeatherForecast,
  FeedTicketItem,
  FeedTicketListItem,
  IssueItem,
  IssueType,
  PlacementFilterMeta,
  PlacementDayItem,
  PlacementSummary,
  OperationsCalendarEvent,
  RecentMortalityHistoryDay,
  UserProfile,
  WeightEntryItem,
} from "./src/types";

type Route =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "feed-ticket-list" }
  | { name: "feed-ticket" }
  | { name: "placement-day"; placement: PlacementSummary; initialTab?: PlacementFocusTab }
  | { name: "weight-entry"; placement: PlacementSummary };

type PlacementFocusTab = "daily" | "mortality" | "grade" | "issues";
type WeatherTab = "now" | "forecast" | "farm";

type WeatherCacheEntry = {
  fetchedAt: number;
  forecast: DashboardWeatherForecast;
};

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

type LoginFailureStage = "auth" | "profile" | "dashboard";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<Route>({ name: "login" });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [dashboardMode, setDashboardMode] = useState<"flocks" | "work-orders" | "calendar">("flocks");
  const [actionItems, setActionItems] = useState<ActionItemWorkOrder[]>([]);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const [actionItemsIncludeResolved, setActionItemsIncludeResolved] = useState(false);
  const [operationsCalendarEvents, setOperationsCalendarEvents] = useState<OperationsCalendarEvent[]>([]);
  const [operationsCalendarLoading, setOperationsCalendarLoading] = useState(false);
  const [placementFilters, setPlacementFilters] = useState<PlacementFilterMeta | null>(null);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);
  const [selectedFarmGroupId, setSelectedFarmGroupId] = useState<string | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementDay, setPlacementDay] = useState<PlacementDayItem | null>(null);
  const [placementDayLoading, setPlacementDayLoading] = useState(false);
  const [weightEntry, setWeightEntry] = useState<WeightEntryItem | null>(null);
  const [weightEntryLoading, setWeightEntryLoading] = useState(false);
  const [feedTicket, setFeedTicket] = useState<FeedTicketItem | null>(null);
  const [feedTicketLoading, setFeedTicketLoading] = useState(false);
  const [feedTicketList, setFeedTicketList] = useState<FeedTicketListItem[]>([]);
  const [feedTicketListLoading, setFeedTicketListLoading] = useState(false);
  const [activeLogDate, setActiveLogDate] = useState<string>(todayIso());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weatherVisible, setWeatherVisible] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState<DashboardWeatherForecast | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherFarmId, setWeatherFarmId] = useState<string | null>(null);
  const [weatherTab, setWeatherTab] = useState<WeatherTab>("now");
  const [reauthVisible, setReauthVisible] = useState(false);
  const [reauthMessage, setReauthMessage] = useState<string | null>(null);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const weatherCacheRef = useRef<Record<string, WeatherCacheEntry>>({});

  useEffect(() => {
    void bootstrap();
  }, []);

  const headerTitle = useMemo(() => {
    if (route.name === "login") return "FlockTrax";
    if (route.name === "dashboard") {
      if (dashboardMode === "work-orders") return "Farm Work Orders";
      if (dashboardMode === "calendar") return "Operations Calendar";
      return "Active Flocks";
    }
    if (route.name === "feed-ticket-list") return "Feed Tickets";
    if (route.name === "feed-ticket") return "Feed Ticket";
    return `${route.placement.farm_name} - ${route.placement.barn_code}`;
  }, [route, dashboardMode]);

  const weatherFarmOptions = useMemo(() => {
    const displayedFarmIds = new Set(placements.map((placement) => placement.farm_id));
    return (placementFilters?.available_farms ?? []).filter((farm) => displayedFarmIds.has(farm.farm_id));
  }, [placementFilters?.available_farms, placements]);

  const mobileAccess = useMemo(
    () => ({
      canSaveDailyLogs: profile?.can_write_daily_logs === true,
      canSaveMortality: profile?.can_write_log_mortality === true,
      canSaveWeightSamples: profile?.can_write_weight_samples === true,
      canSaveFeedTickets: profile?.can_write_feed_tickets === true,
      canSaveGradeBirds: profile?.can_write_grade_birds === true,
    }),
    [profile],
  );

  async function bootstrap() {
    try {
      const stored = await loadStoredSession();
      if (!stored?.accessToken) {
        return;
      }

      const me = await getProfile(stored.accessToken);
      setSession(stored);
      setProfile(me);
      setRoute({ name: "dashboard" });
      await refreshPlacements(stored.accessToken, null, true);
    } catch {
      await clearStoredSession();
      setSession(null);
      setProfile(null);
      setRoute({ name: "login" });
    } finally {
      setBooting(false);
    }
  }

  async function handleLogin(email: string, password: string, rememberMe: boolean) {
    await authenticateUser(email, password, rememberMe, { preserveRoute: false });
  }

  async function handleReauthenticate(email: string, password: string, rememberMe: boolean) {
    await authenticateUser(email, password, rememberMe, { preserveRoute: true });
  }

  async function authenticateUser(
    email: string,
    password: string,
    rememberMe: boolean,
    options: { preserveRoute: boolean },
  ) {
    setErrorMessage(null);

    let nextSession: AuthSession;
    try {
      nextSession = await login(email, password);
    } catch (error) {
      throw new Error(formatLoginStageError("auth", error));
    }

    let me: UserProfile;
    try {
      me = await getProfile(nextSession.accessToken);
    } catch (error) {
      throw new Error(formatLoginStageError("profile", error));
    }

    setSession(nextSession);
    setProfile(me);
    if (rememberMe) {
      await persistSession(nextSession);
    } else {
      await clearStoredSession();
    }
    setReauthVisible(false);
    setReauthMessage(null);
    if (!options.preserveRoute) {
      setRoute({ name: "dashboard" });
    }

    try {
      await refreshPlacements(nextSession.accessToken, selectedFarmGroupId, !options.preserveRoute, {
        throwOnError: true,
      });
    } catch (error) {
      throw new Error(formatLoginStageError("dashboard", error));
    }
  }

  async function presentReauthModal(error: unknown) {
    await clearStoredSession();
    setReauthVisible(true);
    setReauthMessage(errorToMessage(error));
    setErrorMessage(null);
  }

  async function handleAppError(error: unknown) {
    if (isAuthError(error)) {
      await presentReauthModal(error);
      return true;
    }

    setErrorMessage(errorToMessage(error));
    return false;
  }

  async function refreshPlacements(
    accessToken = session?.accessToken,
    farmGroupId = selectedFarmGroupId,
    resetSelection = false,
    options: { throwOnError?: boolean } = {},
  ) {
    if (!accessToken) return;
    setPlacementsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await listPlacements(accessToken, { farmGroupId });
      setPlacements(payload.items);
      setPlacementFilters(payload.filters);
      setDashboardSettings(payload.settings);
      const resolvedFarmGroupId = resetSelection
        ? payload.filters?.selected_farm_group_id ?? null
        : farmGroupId ?? payload.filters?.selected_farm_group_id ?? null;
      setSelectedFarmGroupId(resolvedFarmGroupId);
      setSelectedFarmId((currentFarmId) => {
        if (!currentFarmId) return currentFarmId;
        const stillAvailable = (payload.filters?.available_farms ?? []).some((farm) => farm.farm_id === currentFarmId);
        return stillAvailable ? currentFarmId : null;
      });
      return payload;
    } catch (error) {
      const handled = await handleAppError(error);
      if (options.throwOnError) {
        if (handled && error instanceof AuthError) {
          throw error;
        }
        throw error instanceof Error ? error : new Error(errorToMessage(error));
      }
    } finally {
      setPlacementsLoading(false);
    }
  }

  async function refreshActionItems(
    accessToken = session?.accessToken,
    includeResolved = actionItemsIncludeResolved,
  ) {
    if (!accessToken) return;
    setActionItemsLoading(true);
    setErrorMessage(null);
    try {
      setActionItems(await listActionItems(accessToken, includeResolved));
    } catch (error) {
      await handleAppError(error);
    } finally {
      setActionItemsLoading(false);
    }
  }

  async function refreshOperationsCalendar(accessToken = session?.accessToken) {
    if (!accessToken) return;
    setOperationsCalendarLoading(true);
    setErrorMessage(null);
    try {
      setOperationsCalendarEvents(await listOperationsCalendar(accessToken));
    } catch (error) {
      await handleAppError(error);
    } finally {
      setOperationsCalendarLoading(false);
    }
  }

  function selectDashboardMode(mode: "flocks" | "work-orders" | "calendar") {
    setDashboardMode(mode);
    if (mode === "work-orders") {
      void refreshActionItems();
    } else if (mode === "calendar") {
      void refreshOperationsCalendar();
    }
  }

  async function handleMarkChicksArrived(placement: PlacementSummary) {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to change placement state.");
    }

    await markChicksArrived(session.accessToken, placement.placement_id);
    const refreshed = await refreshPlacements(
      session.accessToken,
      selectedFarmGroupId,
      false,
      { throwOnError: true },
    );

    const updatedPlacement =
      refreshed?.items.find((item) => item.placement_id === placement.placement_id) ??
      {
        ...placement,
        is_in_barn: true,
        is_active: true,
      };

    return updatedPlacement;
  }

  async function openPlacement(
    placement: PlacementSummary,
    logDate = todayIso(),
    options: { initialTab?: PlacementFocusTab; preserveExisting?: boolean } = {},
  ) {
    if (!session?.accessToken) return;

    setActiveLogDate(logDate);
    if (!options.preserveExisting) {
      setPlacementDay(null);
    }
    setPlacementDayLoading(true);
    setErrorMessage(null);

    try {
      const item = await getPlacementDay(
        session.accessToken,
        placement.placement_id,
        logDate,
      );
      const hydratedItem = await hydratePlacementDayWeather(placement, logDate, item);
      setPlacementDay(hydratedItem);
      setRoute({ name: "placement-day", placement, initialTab: options.initialTab });
    } catch (error) {
      await handleAppError(error);
    } finally {
      setPlacementDayLoading(false);
    }
  }

  async function savePlacementDay(item: PlacementDayItem) {
    if (!session?.accessToken) return;

    setPlacementDayLoading(true);
    setErrorMessage(null);

    try {
      const saved = await submitPlacementDay(session.accessToken, item);
      setPlacementDay(saved);
      await refreshPlacements();
      return saved;
    } catch (error) {
      await handleAppError(error);
      throw error;
    } finally {
      setPlacementDayLoading(false);
    }
  }

  async function syncPlacementIssueBundle(bundle: {
    barn_id: string;
    barn_issues: IssueItem[];
    placement_issues: IssueItem[];
  }) {
    setPlacementDay((current) =>
      current
        ? {
            ...current,
            barn_id: bundle.barn_id,
            barn_issues: bundle.barn_issues,
            placement_issues: bundle.placement_issues,
          }
        : current,
    );
    await refreshPlacements();
    return bundle;
  }

  async function handleCreateIssue(input: {
    entityType: "barn" | "placement";
    entityId: string;
    issueType: IssueType;
    description?: string | null;
    placementId?: string | null;
    reportedLogDate?: string | null;
  }) {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to create an issue.");
    }

    try {
      const bundle = await createIssue(session.accessToken, input);
      return await syncPlacementIssueBundle(bundle);
    } catch (error) {
      await handleAppError(error);
      throw error;
    }
  }

  async function handleAddIssueUpdate(input: {
    issueId: string;
    entryText: string;
    resolved?: boolean;
  }) {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to post an issue update.");
    }

    try {
      const bundle = await addIssueUpdate(session.accessToken, input);
      return await syncPlacementIssueBundle(bundle);
    } catch (error) {
      await handleAppError(error);
      throw error;
    }
  }

  async function openWeightEntry(
    placement: PlacementSummary,
    logDate = activeLogDate,
  ) {
    if (!session?.accessToken) return;

    setActiveLogDate(logDate);
    setWeightEntry(null);
    setWeightEntryLoading(true);
    setErrorMessage(null);

    try {
      const item = await getWeightEntry(
        session.accessToken,
        placement.placement_id,
        logDate,
      );
      setWeightEntry(item);
      setRoute({ name: "weight-entry", placement });
    } catch (error) {
      await handleAppError(error);
    } finally {
      setWeightEntryLoading(false);
    }
  }

  async function saveWeightEntry(item: WeightEntryItem) {
    if (!session?.accessToken) return;

    setWeightEntryLoading(true);
    setErrorMessage(null);

    try {
      const saved = await submitWeightEntry(session.accessToken, item);
      setWeightEntry(saved);
    } catch (error) {
      await handleAppError(error);
      throw error;
    } finally {
      setWeightEntryLoading(false);
    }
  }

  async function openFeedTicketList(options: {
    ticketNumber?: string | null;
    flockCode?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  } = {}) {
    if (!session?.accessToken) return;

    setFeedTicketListLoading(true);
    setErrorMessage(null);

    try {
      const payload = await listFeedTickets(session.accessToken, options);
      setFeedTicketList(applyFeedTicketFilters(payload.items, options));
      setRoute({ name: "feed-ticket-list" });
    } catch (error) {
      await handleAppError(error);
    } finally {
      setFeedTicketListLoading(false);
    }
  }

  async function openFeedTicket(ticketId?: string | null) {
    if (!session?.accessToken) return;

    setFeedTicket(null);
    setFeedTicketLoading(true);
    setErrorMessage(null);

    try {
      const item = await getFeedTicket(session.accessToken, ticketId);
      setFeedTicket(item);
      setRoute({ name: "feed-ticket" });
    } catch (error) {
      await handleAppError(error);
    } finally {
      setFeedTicketLoading(false);
    }
  }

  async function saveFeedTicket(item: FeedTicketItem) {
    if (!session?.accessToken) return;

    setFeedTicketLoading(true);
    setErrorMessage(null);

    try {
      const saved = await submitFeedTicket(session.accessToken, item);
      setFeedTicket(saved);
      const payload = await listFeedTickets(session.accessToken);
      setFeedTicketList(payload.items);
    } catch (error) {
      await handleAppError(error);
      throw error;
    } finally {
      setFeedTicketLoading(false);
    }
  }

  function handleLockSession() {
    setErrorMessage(null);
    setReauthVisible(true);
    setReauthMessage("Session locked. Sign in again to continue where you left off.");
  }

  async function handleDeleteAccount(confirmation: string) {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to delete this account.");
    }

    await deleteCurrentAccount(session.accessToken, confirmation);
    await clearStoredSession();
    setSession(null);
    setProfile(null);
    setPlacements([]);
    setActionItems([]);
    setActionItemsIncludeResolved(false);
    setOperationsCalendarEvents([]);
    setDashboardMode("flocks");
    setPlacementFilters(null);
    setDashboardSettings(null);
    setSelectedFarmGroupId(null);
    setSelectedFarmId(null);
    setPlacementDay(null);
    setWeightEntry(null);
    setFeedTicket(null);
    setFeedTicketList([]);
    setRoute({ name: "login" });
    setErrorMessage(null);
    setReauthVisible(false);
    setReauthMessage(null);
  }

  async function confirmDeleteAccount() {
    try {
      setDeleteAccountSubmitting(true);
      setDeleteAccountError(null);
      await handleDeleteAccount(deleteAccountConfirmation);
      setDeleteAccountVisible(false);
      setDeleteAccountConfirmation("");
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error ? error.message : "Account deletion could not be completed.",
      );
    } finally {
      setDeleteAccountSubmitting(false);
    }
  }

  async function handleResumeSession() {
    if (!session?.accessToken) {
      throw new Error("No active session to resume.");
    }

    setRoute({ name: "dashboard" });
    await refreshPlacements(session.accessToken, selectedFarmGroupId, true);
  }

  async function openDashboardWeather() {
    setWeatherVisible(true);
    setWeatherTab("now");
    const initialFarm =
      weatherFarmOptions.find((farm) => farm.farm_id === selectedFarmId) ??
      weatherFarmOptions[0] ??
      null;
    setWeatherFarmId(initialFarm?.farm_id ?? null);
    if (initialFarm) {
      await loadDashboardWeather(initialFarm.farm_id);
      return;
    }
    setWeatherForecast(null);
    setWeatherError("No displayed farm has weather coordinates available.");
  }

  async function loadDashboardWeather(farmId: string) {
    setWeatherLoading(true);
    setWeatherForecast(null);
    setWeatherError(null);

    try {
      const farm = weatherFarmOptions.find((item) => item.farm_id === farmId);
      if (!farm) {
        throw new Error("The selected farm is not available on this dashboard.");
      }
      if (typeof farm.latitude !== "number" || typeof farm.longitude !== "number") {
        throw new Error(`Farm coordinates are missing for ${farm.farm_name}.`);
      }

      const forecast = await fetchFarmForecastCached({
        farmName: farm.farm_name,
        latitude: farm.latitude,
        longitude: farm.longitude,
      });
      setWeatherForecast(forecast);
    } catch (error) {
      setWeatherError(errorToMessage(error));
    } finally {
      setWeatherLoading(false);
    }
  }

  async function loadRecentMortalityHistory(
    placement: PlacementSummary,
  ): Promise<RecentMortalityHistoryDay[]> {
    if (!session?.accessToken) {
      throw new Error("You must be signed in to view mortality history.");
    }

    const dates = Array.from({ length: 8 }, (_, index) =>
      addDaysToIsoDate(todayIso(), index - 7),
    );

    const rows = await Promise.all(
      dates.map(async (logDate) => {
        const item = await getPlacementDay(session.accessToken, placement.placement_id, logDate);
        return {
          log_date: logDate,
          dead_male: item.dead_male,
          dead_female: item.dead_female,
          cull_male: item.cull_male,
          cull_female: item.cull_female,
        } satisfies RecentMortalityHistoryDay;
      }),
    );

    return rows;
  }

  async function hydratePlacementDayWeather(
    placement: PlacementSummary,
    logDate: string,
    item: PlacementDayItem,
  ) {
    if (!isTodayIso(logDate)) {
      return item;
    }

    if (
      item.rel_humidity !== null &&
      item.outside_temp_current !== null &&
      item.outside_temp_low !== null &&
      item.outside_temp_high !== null
    ) {
      return item;
    }

    try {
      const weatherContext = resolveFarmWeatherContext(placement);
      if (!weatherContext) {
        return item;
      }

      const forecast = await fetchFarmForecastCached(weatherContext);

      return {
        ...item,
        rel_humidity: item.rel_humidity ?? forecast.currentRelativeHumidity ?? null,
        outside_temp_current:
          item.outside_temp_current ?? forecast.currentTemperature ?? null,
        outside_temp_low: item.outside_temp_low ?? forecast.dailyLow ?? null,
        outside_temp_high: item.outside_temp_high ?? forecast.dailyHigh ?? null,
      };
    } catch {
      return item;
    }
  }

  function resolveFarmWeatherContext(placement: PlacementSummary) {
    if (
      typeof placement.farm_latitude === "number" &&
      typeof placement.farm_longitude === "number"
    ) {
      return {
        farmName: placement.farm_name,
        latitude: placement.farm_latitude,
        longitude: placement.farm_longitude,
      };
    }

    const fallbackFarm = (placementFilters?.available_farms ?? []).find(
      (farm) => farm.farm_id === placement.farm_id,
    );

    if (
      fallbackFarm &&
      typeof fallbackFarm.latitude === "number" &&
      typeof fallbackFarm.longitude === "number"
    ) {
      return {
        farmName: fallbackFarm.farm_name,
        latitude: fallbackFarm.latitude,
        longitude: fallbackFarm.longitude,
      };
    }

    return null;
  }

  async function fetchFarmForecastCached(input: {
    farmName: string;
    latitude: number;
    longitude: number;
  }) {
    const cacheKey = `${input.farmName}:${input.latitude}:${input.longitude}`;
    const cached = weatherCacheRef.current[cacheKey];
    const now = Date.now();

    if (cached && now - cached.fetchedAt <= WEATHER_CACHE_TTL_MS) {
      return cached.forecast;
    }

    const forecast = await getDashboardWeatherForecast(input);
    weatherCacheRef.current[cacheKey] = {
      fetchedAt: now,
      forecast,
    };
    return forecast;
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.bootScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#7B4B2A" />
        <Text style={styles.bootText}>Loading FlockTrax...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {route.name !== "login" ? (
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Field Operations</Text>
              <Text style={styles.title}>{headerTitle}</Text>
              {route.name === "dashboard" && profile ? (
                <>
                  <Text numberOfLines={1} style={styles.headerUserLine}>
                    {formatDashboardUser(profile)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setDeleteAccountError(null);
                      setDeleteAccountConfirmation("");
                      setDeleteAccountVisible(true);
                    }}
                    style={styles.headerDeleteAccountButton}
                  >
                    <Text style={styles.headerDeleteAccountButtonText}>Delete Account</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
            {route.name === "dashboard" ? (
              <View style={styles.headerActions}>
                <Pressable onPress={() => void openDashboardWeather()} style={styles.weatherHeaderButton}>
                  <Text style={styles.weatherHeaderButtonIcon}>☁</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {route.name === "login" ? (
          <LoginScreen
            hasActiveSession={Boolean(session?.accessToken)}
            onForgotPassword={async (email) => {
              await requestPasswordReset(email);
            }}
            onLogin={handleLogin}
            onResumeSession={handleResumeSession}
          />
        ) : null}

        {route.name === "dashboard" ? (
          <View style={styles.dashboardWorkspace}>
            <View style={styles.dashboardModeSwitch}>
              <Pressable
                onPress={() => selectDashboardMode("flocks")}
                style={[styles.dashboardModeButton, dashboardMode === "flocks" && styles.dashboardModeButtonActive]}
              >
                <Text style={[styles.dashboardModeButtonText, dashboardMode === "flocks" && styles.dashboardModeButtonTextActive]}>
                  Barn Care
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectDashboardMode("work-orders")}
                style={[styles.dashboardModeButton, dashboardMode === "work-orders" && styles.dashboardModeButtonActive]}
              >
                <Text style={[styles.dashboardModeButtonText, dashboardMode === "work-orders" && styles.dashboardModeButtonTextActive]}>
                  Work Orders{actionItems.length > 0 ? `  ${actionItems.length}` : ""}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectDashboardMode("calendar")}
                style={[styles.dashboardModeButton, dashboardMode === "calendar" && styles.dashboardModeButtonActive]}
              >
                <Text style={[styles.dashboardModeButtonText, dashboardMode === "calendar" && styles.dashboardModeButtonTextActive]}>
                  Calendar
                </Text>
              </Pressable>
            </View>
            {dashboardMode === "flocks" ? (
              <DashboardScreen
                canViewRecentMortality={
                  mobileAccess.canSaveMortality ||
                  mobileAccess.canSaveDailyLogs ||
                  mobileAccess.canSaveGradeBirds
                }
                filters={placementFilters}
                loading={placementsLoading}
                onOpenRecentMortalityHistory={loadRecentMortalityHistory}
                placements={placements}
                selectedFarmId={selectedFarmId}
                settings={dashboardSettings}
                selectedFarmGroupId={selectedFarmGroupId}
                onOpenFeedTicket={() => void openFeedTicketList()}
                onLogout={handleLockSession}
                onMarkChicksArrived={handleMarkChicksArrived}
                onOpenBarnIssues={(placement) => {
                  void openPlacement(placement, todayIso(), { initialTab: "issues" });
                }}
                onOpenPlacement={openPlacement}
                onRefresh={() => refreshPlacements()}
                onSelectFarm={setSelectedFarmId}
                onSelectFarmGroup={(farmGroupId) => {
                  setSelectedFarmGroupId(farmGroupId);
                  setSelectedFarmId(null);
                  void refreshPlacements(session?.accessToken, farmGroupId);
                }}
              />
            ) : dashboardMode === "work-orders" ? (
              <ActionItemsScreen
                includeResolved={actionItemsIncludeResolved}
                items={actionItems}
                loading={actionItemsLoading}
                onAddUpdate={async (input) => {
                  await handleAddIssueUpdate(input);
                  await refreshActionItems();
                }}
                onIncludeResolvedChange={(includeResolved) => {
                  setActionItemsIncludeResolved(includeResolved);
                  void refreshActionItems(session?.accessToken, includeResolved);
                }}
                onRefresh={() => void refreshActionItems()}
              />
            ) : (
              <OperationsCalendarScreen
                events={operationsCalendarEvents}
                loading={operationsCalendarLoading}
                onRefresh={() => void refreshOperationsCalendar()}
              />
            )}
          </View>
        ) : null}

        {route.name === "feed-ticket-list" ? (
          <FeedTicketListScreen
            items={feedTicketList}
            loading={feedTicketListLoading}
            onBack={() => setRoute({ name: "dashboard" })}
            onCreateNew={() => {
              void openFeedTicket();
            }}
            onOpenTicket={(ticketId) => {
              void openFeedTicket(ticketId);
            }}
            onSearch={(filters) => {
              void openFeedTicketList(filters);
            }}
          />
        ) : null}

        {route.name === "placement-day" ? (
          <PlacementDayScreen
            canSaveDailyLogs={mobileAccess.canSaveDailyLogs}
            canSaveGradeBirds={mobileAccess.canSaveGradeBirds}
            canSaveMortality={mobileAccess.canSaveMortality}
            item={placementDay}
            loading={placementDayLoading}
            logDate={activeLogDate}
            initialTab={route.initialTab}
            onAddIssueUpdate={handleAddIssueUpdate}
            onCreateIssue={handleCreateIssue}
            placement={route.placement}
            settings={dashboardSettings}
            onBack={() => setRoute({ name: "dashboard" })}
            onChangeDate={setActiveLogDate}
            onLoadDate={(nextDate) => {
              setActiveLogDate(nextDate);
              void openPlacement(route.placement, nextDate, { preserveExisting: true });
            }}
            onOpenWeightEntry={() => {
              void openWeightEntry(route.placement, activeLogDate);
            }}
            onSave={savePlacementDay}
          />
        ) : null}

        {route.name === "feed-ticket" ? (
          <FeedTicketScreen
            canSave={mobileAccess.canSaveFeedTickets}
            item={feedTicket}
            loading={feedTicketLoading}
            onBack={() => setRoute({ name: "feed-ticket-list" })}
            onSave={saveFeedTicket}
          />
        ) : null}

        {route.name === "weight-entry" ? (
          <WeightEntryScreen
            canSave={mobileAccess.canSaveWeightSamples}
            item={weightEntry}
            loading={weightEntryLoading}
            logDate={activeLogDate}
            placement={route.placement}
            onBack={() => setRoute({ name: "placement-day", placement: route.placement })}
            onSave={saveWeightEntry}
          />
        ) : null}

        <Modal
          animationType="fade"
          transparent
          visible={reauthVisible}
          onRequestClose={() => undefined}
        >
          <View style={styles.reauthScrim}>
            <View style={styles.reauthCard}>
              <LoginScreen
                initialEmail={session?.email ?? profile?.email ?? ""}
                mode="reauth"
                onForgotPassword={async (email) => {
                  await requestPasswordReset(email);
                }}
                onLogin={handleReauthenticate}
              />
              {reauthMessage ? (
                <Text style={styles.reauthMessage}>{reauthMessage}</Text>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          transparent
          visible={weatherVisible}
          onRequestClose={() => setWeatherVisible(false)}
        >
          <View style={styles.weatherModalScrim}>
            <View style={styles.weatherModalCard}>
              <ScrollView contentContainerStyle={styles.weatherModalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.weatherModalEyebrow}>Local Weather</Text>
              <Text style={styles.weatherModalTitle}>
                {weatherForecast?.farmName ?? "Farm Forecast"}
              </Text>

              <View style={styles.weatherFarmSelector}>
                <Text style={styles.weatherFarmSelectorLabel}>Farm</Text>
                <View style={styles.weatherFarmSelectorOptions}>
                  {weatherFarmOptions.map((farm) => {
                    const active = farm.farm_id === weatherFarmId;
                    return (
                      <Pressable
                        key={farm.farm_id}
                        onPress={() => {
                          setWeatherFarmId(farm.farm_id);
                          void loadDashboardWeather(farm.farm_id);
                        }}
                        style={[styles.weatherFarmOption, active && styles.weatherFarmOptionActive]}
                      >
                        <Text style={[styles.weatherFarmOptionText, active && styles.weatherFarmOptionTextActive]}>
                          {farm.farm_name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.weatherTabs}>
                {(["now", "forecast", "farm"] as const).map((tab) => {
                  const active = weatherTab === tab;
                  const label = tab === "now" ? "Now" : tab === "forecast" ? "Forecast" : "Farm Details";
                  return (
                    <Pressable key={tab} onPress={() => setWeatherTab(tab)} style={[styles.weatherTab, active && styles.weatherTabActive]}>
                      <Text style={[styles.weatherTabText, active && styles.weatherTabTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {weatherLoading ? (
                <View style={styles.weatherLoadingBlock}>
                  <ActivityIndicator size="large" color="#8B572A" />
                  <Text style={styles.weatherLoadingText}>Loading current conditions...</Text>
                </View>
              ) : weatherError ? (
                <View style={styles.weatherErrorBlock}>
                  <Text style={styles.weatherErrorText}>{weatherError}</Text>
                </View>
              ) : weatherForecast ? (
                <>
                  {weatherTab === "now" ? (
                    <>
                      <View style={styles.weatherSummaryRow}>
                        <WeatherMetric label="Current" value={formatTemperature(weatherForecast.currentTemperature)} />
                        <WeatherMetric label="Feels" value={formatTemperature(weatherForecast.currentApparentTemperature)} />
                        <WeatherMetric label="Humidity" value={formatPercent(weatherForecast.currentRelativeHumidity)} />
                      </View>
                      <Text style={styles.weatherWindLine}>
                        Wind {formatSpeed(weatherForecast.currentWindSpeed)}
                      </Text>
                      <View style={styles.weatherNarrativeCard}>
                        <Text style={styles.weatherNarrativeTitle}>{describeWeatherCode(weatherForecast.currentWeatherCode)}</Text>
                        <Text style={styles.weatherNarrativeText}>{buildFarmWeatherSummary(weatherForecast)}</Text>
                        <Text style={styles.weatherNarrativeMeta}>
                          Today {formatTemperature(weatherForecast.dailyLow)} to {formatTemperature(weatherForecast.dailyHigh)} · Rain {formatPercent(weatherForecast.precipitationProbabilityMax)}
                        </Text>
                      </View>
                    </>
                  ) : null}

                  {weatherTab === "forecast" ? (
                    <View style={styles.weatherForecastSection}>
                      <Text style={styles.weatherSectionTitle}>Next 12 Hours</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherHourlyRow}>
                        {(weatherForecast.hourly ?? []).map((hour) => (
                          <View key={hour.time} style={styles.weatherHourlyCard}>
                            <Text style={styles.weatherHourlyTime}>{formatWeatherHour(hour.time)}</Text>
                            <Text style={styles.weatherHourlyTemp}>{formatTemperature(hour.temperature)}</Text>
                            <Text style={styles.weatherHourlyCondition}>{describeWeatherCode(hour.weatherCode)}</Text>
                            <Text style={styles.weatherHourlyMeta}>Rain {formatPercent(hour.precipitationProbability)}</Text>
                            <Text style={styles.weatherHourlyMeta}>Gust {formatSpeed(hour.windGust)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                      <Text style={styles.weatherSectionTitle}>Seven Days</Text>
                      {(weatherForecast.daily ?? []).map((day) => (
                        <View key={day.date} style={styles.weatherDailyRow}>
                          <View style={styles.weatherDailyCopy}>
                            <Text style={styles.weatherDailyDay}>{formatWeatherDay(day.date)}</Text>
                            <Text style={styles.weatherDailyCondition}>{describeWeatherCode(day.weatherCode)}</Text>
                          </View>
                          <Text style={styles.weatherDailyRain}>{formatPercent(day.precipitationProbabilityMax)}</Text>
                          <Text style={styles.weatherDailyTemps}>{formatTemperature(day.low)} / {formatTemperature(day.high)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {weatherTab === "farm" ? (
                    <View style={styles.weatherDetailsCard}>
                      <WeatherDetailRow label="Dew point" value={formatTemperature(weatherForecast.currentDewPoint)} />
                      <WeatherDetailRow label="Wind direction" value={formatWindDirection(weatherForecast.currentWindDirection)} />
                      <WeatherDetailRow label="Current gust" value={formatSpeed(weatherForecast.currentWindGust)} />
                      <WeatherDetailRow label="Cloud cover" value={formatPercent(weatherForecast.currentCloudCover)} />
                      <WeatherDetailRow label="Visibility" value={formatVisibility(weatherForecast.currentVisibility)} />
                      <WeatherDetailRow label="Sea-level pressure" value={formatPressure(weatherForecast.currentPressure)} />
                      <WeatherDetailRow label="Rain now" value={formatPrecipitation(weatherForecast.currentPrecipitation)} />
                      <WeatherDetailRow label="Rain total today" value={formatPrecipitation(weatherForecast.daily[0]?.precipitationSum ?? null)} />
                      <WeatherDetailRow label="Peak wind / gust" value={`${formatSpeed(weatherForecast.daily[0]?.windSpeedMax ?? null)} / ${formatSpeed(weatherForecast.daily[0]?.windGustMax ?? null)}`} />
                      <WeatherDetailRow label="Sunrise / sunset" value={`${formatClockTime(weatherForecast.daily[0]?.sunrise ?? null)} / ${formatClockTime(weatherForecast.daily[0]?.sunset ?? null)}`} />
                      <WeatherDetailRow label="UV index" value={formatNumber(weatherForecast.daily[0]?.uvIndexMax ?? null)} />
                      {weatherForecast.timezone ? <WeatherDetailRow label="Time zone" value={weatherForecast.timezone} /> : null}
                    </View>
                  ) : null}
                </>
              ) : null}

              <Pressable onPress={() => setWeatherVisible(false)} style={styles.weatherCloseButton}>
                <Text style={styles.weatherCloseButtonText}>Close</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <DeleteAccountModal
          confirmation={deleteAccountConfirmation}
          error={deleteAccountError}
          submitting={deleteAccountSubmitting}
          visible={deleteAccountVisible}
          onChangeConfirmation={setDeleteAccountConfirmation}
          onCancel={() => {
            if (deleteAccountSubmitting) return;
            setDeleteAccountVisible(false);
            setDeleteAccountConfirmation("");
            setDeleteAccountError(null);
          }}
          onConfirm={() => void confirmDeleteAccount()}
        />
      </View>
    </SafeAreaView>
  );
}

function applyFeedTicketFilters(
  items: FeedTicketListItem[],
  options: {
    ticketNumber?: string | null;
    flockCode?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
) {
  const ticketNeedle = options.ticketNumber?.trim().toLowerCase() ?? "";
  const flockNeedle = options.flockCode?.trim().toLowerCase() ?? "";
  const dateFrom = options.dateFrom?.trim() || null;
  const dateTo = options.dateTo?.trim() || null;

  return items.filter((item) => {
    const ticketMatches = !ticketNeedle ||
      (item.ticket_number ?? "").toLowerCase().includes(ticketNeedle);

    const flockMatches = !flockNeedle ||
      item.placement_codes.some((code) => code.toLowerCase().includes(flockNeedle));

    const deliveryDate = item.delivery_date ?? "";
    const fromMatches = !dateFrom || (deliveryDate && deliveryDate >= dateFrom);
    const toMatches = !dateTo || (deliveryDate && deliveryDate <= dateTo);

    return ticketMatches && flockMatches && fromMatches && toMatches;
  });
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function isTodayIso(value: string) {
  return value === todayIso();
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function formatLoginStageError(stage: LoginFailureStage, error: unknown) {
  const detail = errorToMessage(error);

  switch (stage) {
    case "auth":
      return `Sign-in failed at credentials check: ${detail}`;
    case "profile":
      return `Sign-in succeeded, but user profile loading failed: ${detail}`;
    case "dashboard":
      return `Sign-in succeeded, but dashboard loading failed: ${detail}`;
    default:
      return detail;
  }
}

function formatDashboardUser(profile: UserProfile | null) {
  if (!profile) return null;
  if (profile.email?.trim()) return profile.email.trim();
  return null;
}

function formatTemperature(value: number | null) {
  if (value === null) return "--";
  return `${Math.round(value)}°F`;
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${Math.round(value)}%`;
}

function formatSpeed(value: number | null) {
  return value === null ? "--" : `${Math.round(value)} mph`;
}

function formatPrecipitation(value: number | null) {
  return value === null ? "--" : `${value.toFixed(value < 0.1 ? 2 : 1)} in`;
}

function formatVisibility(value: number | null) {
  return value === null ? "--" : `${(value / 1609.344).toFixed(1)} mi`;
}

function formatPressure(value: number | null) {
  return value === null ? "--" : `${Math.round(value)} hPa`;
}

function formatNumber(value: number | null) {
  return value === null ? "--" : value.toFixed(1);
}

function formatWindDirection(value: number | null) {
  if (value === null) return "--";
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${labels[Math.round(value / 45) % labels.length]} · ${Math.round(value)}°`;
}

function formatClockTime(value: string | null) {
  if (!value) return "--";
  const time = value.split("T")[1];
  if (!time) return value;
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function formatWeatherHour(value: string) {
  return formatClockTime(value);
}

function formatWeatherDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function buildFarmWeatherSummary(forecast: DashboardWeatherForecast) {
  const alerts: string[] = [];
  if ((forecast.currentWindGust ?? 0) >= 30) alerts.push("strong gusts may affect outdoor work");
  if ((forecast.precipitationProbabilityMax ?? 0) >= 60) alerts.push("plan around likely rain");
  if ((forecast.currentTemperature ?? 0) >= 90) alerts.push("watch heat load and ventilation");
  if ((forecast.currentTemperature ?? 100) <= 32) alerts.push("protect exposed water systems from freezing");
  if ((forecast.currentRelativeHumidity ?? 0) >= 80) alerts.push("high humidity may reduce cooling efficiency");
  return alerts.length > 0 ? `${alerts.join("; ")}.` : "No immediate weather-related farm warning is indicated.";
}

function describeWeatherCode(code: number | null) {
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
    case 2:
    case 3:
      return "Partly cloudy";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return "Rain";
    case 71:
    case 73:
    case 75:
    case 77:
      return "Snow";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
    case 96:
    case 99:
      return "Thunderstorms";
    default:
      return "Forecast unavailable";
  }
}

type WeatherMetricProps = {
  label: string;
  value: string;
};

function WeatherMetric({ label, value }: WeatherMetricProps) {
  return (
    <View style={styles.weatherMetricCard}>
      <Text style={styles.weatherMetricLabel}>{label}</Text>
      <Text style={styles.weatherMetricValue}>{value}</Text>
    </View>
  );
}

function WeatherDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.weatherDetailRow}>
      <Text style={styles.weatherDetailLabel}>{label}</Text>
      <Text style={styles.weatherDetailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEE4D7",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEE4D7",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dashboardWorkspace: {
    flex: 1,
  },
  dashboardModeSwitch: {
    flexDirection: "row",
    padding: 4,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 14,
    backgroundColor: "#D9CCB8",
  },
  dashboardModeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  dashboardModeButtonActive: {
    backgroundColor: "#2E4639",
  },
  dashboardModeButtonText: {
    color: "#514B43",
    fontSize: 13,
    fontWeight: "800",
  },
  dashboardModeButtonTextActive: {
    color: "#FFF9EC",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D8C9B2",
  },
  headerCopy: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: "#7B4B2A",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#1F2A1F",
    fontSize: 24,
    fontWeight: "800",
  },
  headerUserLine: {
    marginTop: 4,
    color: "#7E776E",
    fontSize: 12,
    fontWeight: "600",
  },
  headerDeleteAccountButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 2,
  },
  headerDeleteAccountButtonText: {
    color: "#A01828",
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  weatherHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  weatherHeaderButtonIcon: {
    color: "#73491F",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  errorBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FCE4DC",
    borderWidth: 1,
    borderColor: "#E59C80",
  },
  errorBannerText: {
    color: "#8A2E0D",
    fontSize: 14,
    fontWeight: "600",
  },
  bootScreen: {
    flex: 1,
    backgroundColor: "#EEE4D7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  bootText: {
    color: "#5D6A5D",
    fontSize: 15,
    fontWeight: "600",
  },
  reauthScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.44)",
    justifyContent: "center",
    padding: 18,
  },
  reauthCard: {
    width: "100%",
    maxWidth: 420,
    minHeight: 520,
    alignSelf: "center",
    maxHeight: "92%",
    borderRadius: 26,
    backgroundColor: "#EEE4D7",
    borderWidth: 1,
    borderColor: "#D8C9B2",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  reauthMessage: {
    color: "#73491F",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 8,
  },
  weatherModalScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  weatherModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "92%",
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    overflow: "hidden",
  },
  weatherModalContent: {
    padding: 18,
    gap: 12,
  },
  weatherModalEyebrow: {
    color: "#7B4B2A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  weatherModalTitle: {
    color: "#1F2A1F",
    fontSize: 20,
    fontWeight: "800",
  },
  weatherFarmSelector: {
    gap: 6,
  },
  weatherFarmSelectorLabel: {
    color: "#7E776E",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  weatherFarmSelectorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  weatherFarmOption: {
    borderWidth: 1,
    borderColor: "#D2B892",
    borderRadius: 999,
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  weatherFarmOptionActive: {
    borderColor: "#2E4639",
    backgroundColor: "#2E4639",
  },
  weatherFarmOptionText: {
    color: "#514B43",
    fontSize: 12,
    fontWeight: "800",
  },
  weatherFarmOptionTextActive: {
    color: "#FFF9EC",
  },
  weatherTabs: {
    flexDirection: "row",
    gap: 5,
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#E7DAC7",
  },
  weatherTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    borderRadius: 9,
    paddingHorizontal: 5,
  },
  weatherTabActive: {
    backgroundColor: "#2E4639",
  },
  weatherTabText: {
    color: "#625C52",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  weatherTabTextActive: {
    color: "#FFF9EC",
  },
  weatherSummaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  weatherMetricCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCC9AF",
    backgroundColor: "#FFFDFC",
    padding: 12,
    gap: 4,
  },
  weatherMetricLabel: {
    color: "#8C897E",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weatherMetricValue: {
    color: "#73491F",
    fontSize: 18,
    fontWeight: "800",
  },
  weatherWindLine: {
    color: "#2E4639",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  weatherNarrativeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCC9AF",
    backgroundColor: "#FFFDFC",
    padding: 14,
    gap: 6,
  },
  weatherNarrativeTitle: {
    color: "#1F2A1F",
    fontSize: 16,
    fontWeight: "800",
  },
  weatherNarrativeText: {
    color: "#4E5550",
    fontSize: 15,
    fontWeight: "600",
  },
  weatherNarrativeMeta: {
    color: "#7E776E",
    fontSize: 13,
    fontWeight: "600",
  },
  weatherForecastSection: {
    gap: 9,
  },
  weatherSectionTitle: {
    color: "#1F2A1F",
    fontSize: 14,
    fontWeight: "900",
  },
  weatherHourlyRow: {
    gap: 8,
    paddingRight: 8,
  },
  weatherHourlyCard: {
    width: 108,
    borderWidth: 1,
    borderColor: "#DCC9AF",
    borderRadius: 14,
    backgroundColor: "#FFFDFC",
    padding: 10,
    gap: 3,
  },
  weatherHourlyTime: {
    color: "#7B4B2A",
    fontSize: 11,
    fontWeight: "900",
  },
  weatherHourlyTemp: {
    color: "#1F2A1F",
    fontSize: 19,
    fontWeight: "900",
  },
  weatherHourlyCondition: {
    color: "#4E5550",
    fontSize: 11,
    fontWeight: "700",
  },
  weatherHourlyMeta: {
    color: "#7E776E",
    fontSize: 10,
    fontWeight: "600",
  },
  weatherDailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E6D8C4",
    paddingVertical: 8,
  },
  weatherDailyCopy: {
    flex: 1,
  },
  weatherDailyDay: {
    color: "#1F2A1F",
    fontSize: 13,
    fontWeight: "900",
  },
  weatherDailyCondition: {
    color: "#777166",
    fontSize: 11,
  },
  weatherDailyRain: {
    color: "#547D88",
    fontSize: 12,
    fontWeight: "800",
  },
  weatherDailyTemps: {
    minWidth: 76,
    color: "#73491F",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  weatherDetailsCard: {
    borderWidth: 1,
    borderColor: "#DCC9AF",
    borderRadius: 16,
    backgroundColor: "#FFFDFC",
    paddingHorizontal: 12,
  },
  weatherDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE3D3",
    paddingVertical: 10,
  },
  weatherDetailLabel: {
    flex: 1,
    color: "#6F685D",
    fontSize: 12,
    fontWeight: "700",
  },
  weatherDetailValue: {
    color: "#1F2A1F",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  weatherLoadingBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  weatherLoadingText: {
    color: "#556255",
    fontSize: 14,
    fontWeight: "600",
  },
  weatherErrorBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E59C80",
    backgroundColor: "#FCE4DC",
    padding: 14,
  },
  weatherErrorText: {
    color: "#8A2E0D",
    fontSize: 14,
    fontWeight: "600",
  },
  weatherCloseButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
  },
  weatherCloseButtonText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
});
