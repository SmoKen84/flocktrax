import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OperationsCalendarEvent } from "../types";

type CalendarMode = "placement" | "livehaul";

type Props = {
  events: OperationsCalendarEvent[];
  loading: boolean;
  onRefresh: () => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OperationsCalendarScreen({ events, loading, onRefresh }: Props) {
  const [mode, setMode] = useState<CalendarMode>("placement");
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState<OperationsCalendarEvent | null>(null);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const lastMonthKey = addMonths(currentMonthKey, 12);

  const monthEvents = useMemo(
    () => events.filter((event) => event.type === mode && event.date.startsWith(monthKey)),
    [events, mode, monthKey],
  );
  const eventsByDate = useMemo(() => {
    const map = new Map<string, OperationsCalendarEvent[]>();
    for (const event of monthEvents) {
      const bucket = map.get(event.date) ?? [];
      bucket.push(event);
      map.set(event.date, bucket);
    }
    return map;
  }, [monthEvents]);
  const days = useMemo(() => buildCalendarDays(monthKey), [monthKey]);

  if (loading && events.length === 0) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#9A512A" /><Text style={styles.loadingText}>Loading operations calendar...</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>READ-ONLY SCHEDULE</Text>
            <Text style={styles.title}>Operations Calendar</Text>
            <Text style={styles.subtitle}>Upcoming chick arrivals and livehaul work for your farms.</Text>
          </View>
          <Pressable onPress={onRefresh} style={styles.refreshButton}><Text style={styles.refreshText}>Refresh</Text></Pressable>
        </View>

        <View style={styles.modeSwitch}>
          <ModeButton active={mode === "placement"} label="Placements" onPress={() => setMode("placement")} />
          <ModeButton active={mode === "livehaul"} label="Livehaul" onPress={() => setMode("livehaul")} />
        </View>

        <View style={styles.monthBar}>
          <Pressable disabled={monthKey <= currentMonthKey} onPress={() => setMonthKey(addMonths(monthKey, -1))} style={[styles.monthButton, monthKey <= currentMonthKey && styles.disabled]}>
            <Text style={styles.monthButtonText}>Previous</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonth(monthKey)}</Text>
          <Pressable disabled={monthKey >= lastMonthKey} onPress={() => setMonthKey(addMonths(monthKey, 1))} style={[styles.monthButton, monthKey >= lastMonthKey && styles.disabled]}>
            <Text style={styles.monthButtonText}>Next</Text>
          </Pressable>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekdayRow}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.dayGrid}>
            {days.map((day) => {
              const dayEvents = day.date ? eventsByDate.get(day.date) ?? [] : [];
              return (
                <View key={day.key} style={[styles.dayCell, !day.inMonth && styles.dayCellOutside]}>
                  {day.inMonth ? <Text style={styles.dayNumber}>{day.day}</Text> : null}
                  {dayEvents.slice(0, 2).map((event) => (
                    <Pressable key={event.id} onPress={() => setSelected(event)} style={[styles.badge, mode === "livehaul" && styles.badgeLivehaul]}>
                      <Text numberOfLines={1} style={styles.badgeTitle}>{event.barn_code}</Text>
                      <Text numberOfLines={1} style={styles.badgeCount}>{formatWhole(event.head_count)}</Text>
                    </Pressable>
                  ))}
                  {dayEvents.length > 2 ? <Text style={styles.moreText}>+{dayEvents.length - 2}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        {monthEvents.length === 0 ? <Text style={styles.empty}>No upcoming {mode === "placement" ? "placements" : "livehaul events"} in this month.</Text> : null}
        <Text style={styles.lockedNote}>Schedule display only. Changes must be made in FlockTrax Admin.</Text>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setSelected(null)} transparent visible={selected !== null}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>{selected?.type === "placement" ? "Scheduled Placement" : "Scheduled Livehaul"}</Text>
            <Text style={styles.modalTitle}>{selected?.placement_code}</Text>
            <Text style={styles.modalLocation}>{selected?.farm_name} · Barn {selected?.barn_code}</Text>
            <DetailRow label="Date" value={formatDate(selected?.date ?? "")} />
            <DetailRow label={selected?.type === "placement" ? "Chicks arriving" : "Birds to be taken"} value={formatWhole(selected?.head_count ?? null)} />
            {selected?.target_sex ? <DetailRow label="Birds" value={selected.target_sex === "male" ? "Males" : "Females"} /> : null}
            <Pressable onPress={() => setSelected(null)} style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function buildCalendarDays(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const count = new Date(year, month, 0).getDate();
  const cells = Math.ceil((first.getDay() + count) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - first.getDay() + 1;
    const inMonth = day >= 1 && day <= count;
    return { key: `${monthKey}-${index}`, day, inMonth, date: inMonth ? `${monthKey}-${String(day).padStart(2, "0")}` : null };
  });
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDate(value: string) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatWhole(value: number | null) {
  return value === null ? "Count not entered" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

const colors = { ink: "#243127", moss: "#2E4639", clay: "#A86138", paper: "#F6EBD8", line: "#D8C9B2", gold: "#C58A2B" };

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: 36 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }, loadingText: { color: colors.ink },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#E8DECB", borderRadius: 16, padding: 14 },
  heroCopy: { flex: 1 }, eyebrow: { color: colors.clay, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 2 }, subtitle: { color: "#686158", fontSize: 12, lineHeight: 17, marginTop: 3 },
  refreshButton: { borderWidth: 1, borderColor: colors.clay, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }, refreshText: { color: colors.clay, fontSize: 11, fontWeight: "900" },
  modeSwitch: { flexDirection: "row", gap: 5, backgroundColor: "#D9CCB8", borderRadius: 13, padding: 4, marginTop: 10 }, modeButton: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 }, modeButtonActive: { backgroundColor: colors.moss }, modeText: { color: "#625C52", fontWeight: "800" }, modeTextActive: { color: "#FFF9EC" },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 }, monthButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: "#FFFDF8", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 }, monthButtonText: { color: colors.clay, fontSize: 11, fontWeight: "900" }, monthTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }, disabled: { opacity: 0.35 },
  calendar: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: "hidden", marginTop: 10, backgroundColor: "#FFFDF8" }, weekdayRow: { flexDirection: "row", backgroundColor: colors.moss }, weekday: { width: `${100 / 7}%`, color: "#FFF9EC", fontSize: 9, fontWeight: "900", textAlign: "center", paddingVertical: 7 }, dayGrid: { flexDirection: "row", flexWrap: "wrap" }, dayCell: { width: `${100 / 7}%`, minHeight: 72, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#E5D8C6", padding: 3 }, dayCellOutside: { backgroundColor: "#EEE7DB" }, dayNumber: { color: colors.ink, fontSize: 10, fontWeight: "900", marginBottom: 2 },
  badge: { backgroundColor: "#D9E5D8", borderLeftWidth: 3, borderLeftColor: colors.moss, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2, marginBottom: 2 }, badgeLivehaul: { backgroundColor: "#F3E1D5", borderLeftColor: colors.clay }, badgeTitle: { color: colors.ink, fontSize: 8, fontWeight: "900" }, badgeCount: { color: "#615B52", fontSize: 7, fontWeight: "700" }, moreText: { color: colors.clay, fontSize: 8, fontWeight: "900" },
  empty: { color: "#746B5E", fontSize: 13, textAlign: "center", paddingVertical: 20 }, lockedNote: { color: "#81796D", fontSize: 11, fontStyle: "italic", textAlign: "center", marginTop: 12 },
  modalScrim: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(28,34,30,0.58)" }, modalCard: { backgroundColor: colors.paper, borderRadius: 22, padding: 18, gap: 10 }, modalEyebrow: { color: colors.clay, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, modalTitle: { color: colors.ink, fontSize: 25, fontWeight: "900" }, modalLocation: { color: colors.moss, fontSize: 14, fontWeight: "800" }, detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }, detailLabel: { flex: 1, color: "#756D62", fontSize: 13, fontWeight: "700" }, detailValue: { color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "right" }, closeButton: { backgroundColor: colors.moss, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 5 }, closeText: { color: "white", fontWeight: "900" },
});
