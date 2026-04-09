import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getFeedTicket,
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

export default function App() {
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<Route>({ name: "login" });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [placements, setPlacements] = useState<PlacementSummary[]>([]);
  const [placementFilters, setPlacementFilters] = useState<PlacementFilterMeta | null>(null);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings | null>(null);
  const [selectedFarmGroupId, setSelectedFarmGroupId] = useState<string | null>(null);
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
    } catch (error) {
      setErrorMessage(errorToMessage(error));
    } finally {
      setPlacementsLoading(false);
    }
  }

  async function openPlacement(
    placement: PlacementSummary,
    logDate = todayIso(),
  ) {
    if (!session?.accessToken) return;

    setActiveLogDate(logDate);
    setPlacementDay(null);
    setPlacementDayLoading(true);
    setErrorMessage(null);

    try {
      const item = await getPlacementDay(
        session.accessToken,
        placement.placement_id,
        logDate,
      );
      setPlacementDay(item);
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
            settings={dashboardSettings}
            selectedFarmGroupId={selectedFarmGroupId}
            onOpenFeedTicket={() => {
              void openFeedTicketList();
            }}
            onLogout={handleLogout}
            onOpenPlacement={openPlacement}
            onRefresh={() => refreshPlacements()}
            onSelectFarmGroup={(farmGroupId) => {
              setSelectedFarmGroupId(farmGroupId);
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
              void openPlacement(route.placement, nextDate);
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

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

function formatDashboardUser(profile: UserProfile | null) {
  if (!profile) return null;
  if (profile.email?.trim()) return profile.email.trim();
  return null;
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
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D8C9B2",
  },
  headerCopy: {
    width: "100%",
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
});
