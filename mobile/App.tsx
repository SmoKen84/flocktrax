import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getFeedTicket,
  getDashboardWeatherForecast,
  listFeedTickets,
  getPlacementDay,
  getProfile,
  getWeightEntry,
  listPlacements,
  login,
  requestPasswordReset,
  submitFeedTicket,
  submitPlacementDay,
  submitWeightEntry,
} from "./src/api/http";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { FeedTicketListScreen } from "./src/screens/FeedTicketListScreen";
import { FeedTicketScreen } from "./src/screens/FeedTicketScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PlacementDayScreen } from "./src/screens/PlacementDayScreen";
import { WeightEntryScreen } from "./src/screens/WeightEntryScreen";
import {
  clearStoredSession,
  loadStoredSession,
  persistSession,
} from "./src/storage/session";
import {
  AuthSession,
  DashboardSettings,
  DashboardWeatherForecast,
  FeedTicketItem,
  FeedTicketListItem,
  PlacementFilterMeta,
  PlacementDayItem,
  PlacementSummary,
  UserProfile,
  WeightEntryItem,
} from "./src/types";

type Route =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "feed-ticket-list" }
  | { name: "feed-ticket" }
  | { name: "placement-day"; placement: PlacementSummary }
  | { name: "weight-entry"; placement: PlacementSummary };

type WeatherCacheEntry = {
  fetchedAt: number;
  forecast: DashboardWeatherForecast;
};

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<Route>({ name: "login" });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
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
  const weatherCacheRef = useRef<Record<string, WeatherCacheEntry>>({});

  useEffect(() => {
    void bootstrap();
  }, []);

  const headerTitle = useMemo(() => {
    if (route.name === "login") return "FlockTrax";
    if (route.name === "dashboard") return "Active Flocks";
    if (route.name === "feed-ticket-list") return "Feed Tickets";
    if (route.name === "feed-ticket") return "Feed Ticket";
    return `${route.placement.farm_name} - ${route.placement.barn_code}`;
  }, [route]);

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
    setErrorMessage(null);
    const nextSession = await login(email, password);
    const me = await getProfile(nextSession.accessToken);

    setSession(nextSession);
    setProfile(me);
    if (rememberMe) {
      await persistSession(nextSession);
    } else {
      await clearStoredSession();
    }
    setRoute({ name: "dashboard" });
    await refreshPlacements(nextSession.accessToken, null, true);
  }

  async function refreshPlacements(
    accessToken = session?.accessToken,
    farmGroupId = selectedFarmGroupId,
    resetSelection = false,
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
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setPlacementsLoading(false);
    }
  }

  async function openPlacement(
    placement: PlacementSummary,
    logDate = todayIso(),
    options: { preserveExisting?: boolean } = {},
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
      setRoute({ name: "placement-day", placement });
    } catch (error) {
      setErrorMessage(errorToMessage(error));
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
      setErrorMessage(errorToMessage(error));
      throw error;
    } finally {
      setPlacementDayLoading(false);
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
      setErrorMessage(errorToMessage(error));
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
      setErrorMessage(errorToMessage(error));
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
      setErrorMessage(errorToMessage(error));
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
      setErrorMessage(errorToMessage(error));
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
      setErrorMessage(errorToMessage(error));
      throw error;
    } finally {
      setFeedTicketLoading(false);
    }
  }

  async function handleLogout() {
    setPlacementDay(null);
    setRoute({ name: "login" });
    setErrorMessage(null);
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
    setWeatherLoading(true);
    setWeatherForecast(null);
    setWeatherError(null);

    try {
      const availableFarms = placementFilters?.available_farms ?? [];
      const farm =
        availableFarms.find((item) => item.farm_id === selectedFarmId) ??
        (availableFarms.length === 1 ? availableFarms[0] : null);

      if (!farm) {
        throw new Error("Select a farm to view the local forecast.");
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

  async function hydratePlacementDayWeather(
    placement: PlacementSummary,
    logDate: string,
    item: PlacementDayItem,
  ) {
    if (!isTodayIso(logDate)) {
      return item;
    }

    if (
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
                <Text numberOfLines={1} style={styles.headerUserLine}>
                  {formatDashboardUser(profile)}
                </Text>
              ) : null}
            </View>
            {route.name === "dashboard" ? (
              <Pressable onPress={() => void openDashboardWeather()} style={styles.weatherHeaderButton}>
                <Text style={styles.weatherHeaderButtonIcon}>☁</Text>
              </Pressable>
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
          <DashboardScreen
            filters={placementFilters}
            loading={placementsLoading}
            placements={placements}
            selectedFarmId={selectedFarmId}
            settings={dashboardSettings}
            selectedFarmGroupId={selectedFarmGroupId}
            onOpenFeedTicket={() => {
              void openFeedTicketList();
            }}
            onLogout={handleLogout}
            onOpenPlacement={openPlacement}
            onRefresh={() => refreshPlacements()}
            onSelectFarm={setSelectedFarmId}
            onSelectFarmGroup={(farmGroupId) => {
              setSelectedFarmGroupId(farmGroupId);
              setSelectedFarmId(null);
              void refreshPlacements(session?.accessToken, farmGroupId);
            }}
          />
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
            item={placementDay}
            loading={placementDayLoading}
            logDate={activeLogDate}
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
            item={feedTicket}
            loading={feedTicketLoading}
            onBack={() => setRoute({ name: "feed-ticket-list" })}
            onSave={saveFeedTicket}
          />
        ) : null}

        {route.name === "weight-entry" ? (
          <WeightEntryScreen
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
          visible={weatherVisible}
          onRequestClose={() => setWeatherVisible(false)}
        >
          <View style={styles.weatherModalScrim}>
            <View style={styles.weatherModalCard}>
              <Text style={styles.weatherModalEyebrow}>Local Weather</Text>
              <Text style={styles.weatherModalTitle}>
                {weatherForecast?.farmName ?? "Farm Forecast"}
              </Text>

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
                  <View style={styles.weatherSummaryRow}>
                    <WeatherMetric label="Current" value={formatTemperature(weatherForecast.currentTemperature)} />
                    <WeatherMetric label="Low" value={formatTemperature(weatherForecast.dailyLow)} />
                    <WeatherMetric label="High" value={formatTemperature(weatherForecast.dailyHigh)} />
                  </View>

                  <View style={styles.weatherNarrativeCard}>
                    <Text style={styles.weatherNarrativeTitle}>Today</Text>
                    <Text style={styles.weatherNarrativeText}>
                      {describeWeatherCode(weatherForecast.dailyWeatherCode)}
                    </Text>
                    <Text style={styles.weatherNarrativeMeta}>
                      {weatherForecast.precipitationProbabilityMax !== null
                        ? `Precipitation chance up to ${Math.round(weatherForecast.precipitationProbabilityMax)}%`
                        : "Precipitation chance unavailable"}
                    </Text>
                    {weatherForecast.timezone ? (
                      <Text style={styles.weatherNarrativeMeta}>
                        Time zone: {weatherForecast.timezone}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}

              <Pressable onPress={() => setWeatherVisible(false)} style={styles.weatherCloseButton}>
                <Text style={styles.weatherCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  return new Date().toISOString().slice(0, 10);
}

function isTodayIso(value: string) {
  return value === todayIso();
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
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
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
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
