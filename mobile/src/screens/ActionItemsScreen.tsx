import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionItemWorkOrder, IssueType } from "../types";

type ViewMode = "barn" | "all";
type Ownership = "all" | "barn" | "placement";
type SortMode = "barn" | "newest" | "oldest";

type Props = {
  includeResolved: boolean;
  items: ActionItemWorkOrder[];
  loading: boolean;
  onAddUpdate: (input: {
    issueId: string;
    entryText: string;
    resolved?: boolean;
  }) => Promise<void>;
  onIncludeResolvedChange: (includeResolved: boolean) => void;
  onRefresh: () => void;
};

const TYPE_LABELS: Record<IssueType, string> = {
  maintenance: "Maintenance",
  feedlines: "Feedlines",
  nipple_lines: "Nipple Lines",
  equipment: "Equipment",
  water: "Water",
  ventilation: "Ventilation",
  bird_health: "Bird Health",
  performance: "Performance",
  mortality_review: "Mortality Review",
};

export function ActionItemsScreen({ includeResolved, items, loading, onAddUpdate, onIncludeResolvedChange, onRefresh }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("barn");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [category, setCategory] = useState<IssueType | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("barn");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ActionItemWorkOrder | null>(null);
  const [entryText, setEntryText] = useState("");
  const [resolved, setResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const modalScrollRef = useRef<ScrollView>(null);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.issue_type))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const result = items.filter((item) => {
      if (ownership !== "all" && item.entity_type !== ownership) return false;
      if (category !== "all" && item.issue_type !== category) return false;
      if (!normalized) return true;
      return [item.farm_name, item.barn_code, item.placement_code, item.title, item.description]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized));
    });

    return result.sort((left, right) => {
      if (sortMode === "newest") return right.opened_at.localeCompare(left.opened_at);
      if (sortMode === "oldest") return left.opened_at.localeCompare(right.opened_at);
      return `${left.farm_name}|${left.barn_code}|${left.opened_at}`.localeCompare(
        `${right.farm_name}|${right.barn_code}|${right.opened_at}`,
      );
    });
  }, [items, ownership, category, search, sortMode]);

  const sections = useMemo(() => {
    const groups = new Map<string, ActionItemWorkOrder[]>();
    for (const item of filtered) {
      const key = `${item.farm_name} - ${item.barn_code}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [filtered]);

  useEffect(() => {
    if (!selected) return;
    const refreshed = items.find((item) => item.id === selected.id);
    if (!refreshed || refreshed === selected) return;

    const receivedNewUpdate = refreshed.updates.length > selected.updates.length;
    setSelected(refreshed);
    if (receivedNewUpdate) {
      setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [items, selected]);

  async function submitUpdate() {
    if (!selected || !entryText.trim()) return;
    try {
      setSubmitting(true);
      setMessage(null);
      await onAddUpdate({ issueId: selected.id, entryText: entryText.trim(), resolved });
      setEntryText("");
      setResolved(false);
      setMessage(resolved ? "Resolution memo saved." : "Memo saved.");
      Keyboard.dismiss();
      setComposerFocused(false);
      if (resolved) {
        setSelected(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update could not be posted.");
    } finally {
      setSubmitting(false);
    }
  }

  const listHeader = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>AFTERNOON WORKSPACE</Text>
          <Text style={styles.heroTitle}>Working Action Items</Text>
          <Text style={styles.heroText}>Open repairs and flock concerns ready for follow-through.</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countValue}>{filtered.length}</Text>
          <Text style={styles.countLabel}>{includeResolved ? "SHOWN" : "OPEN"}</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        <ModeButton active={viewMode === "barn"} label="By Barn" onPress={() => setViewMode("barn")} />
        <ModeButton active={viewMode === "all"} label="All Barns" onPress={() => setViewMode("all")} />
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: includeResolved }}
        onPress={() => onIncludeResolvedChange(!includeResolved)}
        style={styles.includeResolvedRow}
      >
        <View style={[styles.includeResolvedBox, includeResolved && styles.includeResolvedBoxActive]}>
          <Text style={styles.includeResolvedMark}>{includeResolved ? "X" : ""}</Text>
        </View>
        <Text style={styles.includeResolvedLabel}>Include Resolved</Text>
      </Pressable>

      <TextInput
        autoCapitalize="none"
        onChangeText={setSearch}
        placeholder="Search barn, flock, category, or repair"
        placeholderTextColor="#8E8A7D"
        style={styles.searchInput}
        value={search}
      />

      <FilterStrip label="Scope">
        <FilterChip active={ownership === "all"} label="All" onPress={() => setOwnership("all")} />
        <FilterChip active={ownership === "barn"} label="Barn / Maintenance" onPress={() => setOwnership("barn")} />
        <FilterChip active={ownership === "placement"} label="Placement / Birds" onPress={() => setOwnership("placement")} />
      </FilterStrip>
      <FilterStrip label="Category">
        <FilterChip active={category === "all"} label="All" onPress={() => setCategory("all")} />
        {categories.map((value) => (
          <FilterChip key={value} active={category === value} label={TYPE_LABELS[value]} onPress={() => setCategory(value)} />
        ))}
      </FilterStrip>
      <FilterStrip label="Sort">
        <FilterChip active={sortMode === "barn"} label="Barn" onPress={() => setSortMode("barn")} />
        <FilterChip active={sortMode === "newest"} label="Newest" onPress={() => setSortMode("newest")} />
        <FilterChip active={sortMode === "oldest"} label="Oldest" onPress={() => setSortMode("oldest")} />
      </FilterStrip>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );

  if (loading && items.length === 0) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#9A512A" /><Text>Loading work orders...</Text></View>;
  }

  return (
    <View style={styles.wrapper}>
      {viewMode === "barn" ? (
        <SectionList
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<EmptyState includeResolved={includeResolved} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionCount}>{section.data.length}</Text></View>
          )}
          renderItem={({ item }) => (
            <WorkOrderCard
              item={item}
              onPress={() => {
                setMessage(null);
                setSelected(item);
              }}
            />
          )}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<EmptyState includeResolved={includeResolved} />}
          renderItem={({ item }) => (
            <WorkOrderCard
              item={item}
              onPress={() => {
                setMessage(null);
                setSelected(item);
              }}
            />
          )}
        />
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setComposerFocused(false);
          setSelected(null);
        }}
        transparent
        visible={selected !== null}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
          style={styles.modalKeyboardAvoider}
        >
          <View style={[styles.modalScrim, composerFocused && styles.modalScrimKeyboard]}>
            <View style={[styles.modalCard, composerFocused && styles.modalCardKeyboard]}>
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                ref={modalScrollRef}
                style={composerFocused ? styles.modalScrollKeyboard : undefined}
              >
              <Text style={styles.modalEyebrow}>{selected?.farm_name} / {selected?.barn_code}</Text>
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              <Text style={styles.modalMeta}>{selected?.entity_type === "barn" ? "Barn / Maintenance" : `Placement / ${selected?.placement_code ?? "Flock"}`}</Text>
              <Text style={styles.auditLine}>Created {formatDateTime(selected?.opened_at ?? "")} by {selected?.created_by_name ?? "Unknown User"}</Text>
              <Text style={styles.auditLine}>Updated by {selected?.updated_by_name ?? selected?.created_by_name ?? "Unknown User"}</Text>
              {selected?.description ? <Text style={styles.modalDescription}>{selected.description}</Text> : null}

              <Text style={styles.threadTitle}>Ticket history</Text>
              {(selected?.updates ?? []).map((update) => (
                <View key={update.id} style={styles.threadEntry}>
                  <Text style={styles.threadType}>{formatEntryType(update.entry_type)} · {formatDateTime(update.created_at)} · {update.created_by_name ?? "Unknown User"}</Text>
                  <Text style={styles.threadText}>{update.entry_text}</Text>
                </View>
              ))}

              {selected?.status === "resolved" ? (
                <View style={styles.resolvedNotice}>
                  <Text style={styles.resolvedNoticeTitle}>Resolved Work Order</Text>
                  <Text style={styles.resolvedNoticeText}>This completed ticket and its memo history are read-only.</Text>
                </View>
              ) : (
                <>
                  {message ? <Text style={styles.modalMessage}>{message}</Text> : null}
                  <Text style={styles.composerTitle}>Add dated memo</Text>
                  <TextInput
                    multiline
                    onChangeText={setEntryText}
                    onBlur={() => setComposerFocused(false)}
                    onFocus={() => {
                      setComposerFocused(true);
                      setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 180);
                    }}
                    placeholder="What was checked, repaired, learned, or completed?"
                    placeholderTextColor="#8E8A7D"
                    style={styles.noteInput}
                    value={entryText}
                  />
                  <Pressable onPress={() => setResolved((current) => !current)} style={styles.resolvedCheckRow}>
                    <View style={[styles.resolvedCheckBox, resolved && styles.resolvedCheckBoxActive]}>
                      <Text style={styles.resolvedCheckMark}>{resolved ? "X" : ""}</Text>
                    </View>
                    <Text style={styles.resolvedCheckLabel}>Resolved</Text>
                  </Pressable>
                  <Pressable disabled={submitting || !entryText.trim()} onPress={() => void submitUpdate()} style={[styles.primaryButton, (submitting || !entryText.trim()) && styles.disabledButton]}>
                    <Text style={styles.primaryButtonText}>{resolved ? "Save Memo & Resolve" : "Save Memo"}</Text>
                  </Pressable>
                  <Pressable disabled={submitting} onPress={() => setResolved(true)} style={styles.resolveButton}>
                    <Text style={styles.resolveButtonText}>Resolve</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                disabled={submitting}
                onPress={() => {
                  Keyboard.dismiss();
                  setComposerFocused(false);
                  setSelected(null);
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Back to Work Orders</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function WorkOrderCard({ item, onPress }: { item: ActionItemWorkOrder; onPress: () => void }) {
  const latest = item.updates[item.updates.length - 1];
  return (
    <Pressable onPress={onPress} style={styles.orderCard}>
      <View style={[styles.orderStripe, item.status === "resolved" && styles.resolvedStripe]} />
      <View style={styles.orderBody}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderLocation}>{item.farm_name} · {item.barn_code}</Text>
          <Text style={styles.orderAge}>{formatDate(item.opened_at)}</Text>
        </View>
        <Text style={styles.orderTitle}>{item.title}</Text>
        <Text style={styles.orderAudit}>Created by {item.created_by_name ?? "Unknown User"}</Text>
        <Text numberOfLines={2} style={styles.orderDescription}>{item.description ?? "No additional description supplied."}</Text>
        <View style={styles.orderFooter}>
          <Text style={styles.scopeBadge}>{item.entity_type === "barn" ? "BARN" : item.placement_code ?? "PLACEMENT"}</Text>
          <Text style={[styles.statusLabel, item.status === "resolved" && styles.statusLabelResolved]}>{item.status.toUpperCase()}</Text>
          <Text style={styles.updateCount}>{Math.max(0, item.updates.length - 1)} updates</Text>
        </View>
        {latest && latest.entry_type !== "opened" ? <Text numberOfLines={1} style={styles.latestLine}>Latest: {latest.entry_text}</Text> : null}
      </View>
    </Pressable>
  );
}

function FilterStrip({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.filterBlock}><Text style={styles.filterLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>{children}</ScrollView></View>;
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text></Pressable>;
}

function EmptyState({ includeResolved }: { includeResolved: boolean }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>No matching action items</Text><Text style={styles.emptyText}>{includeResolved ? "No open or resolved work matches the selected filters." : "The selected farm, barn, and category filters have no unresolved work."}</Text></View>;
}

function formatEntryType(value: string) {
  if (value === "opened") return "Opened";
  if (value === "resolved") return "Resolved";
  return "Memo";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const colors = { ink: "#24322B", clay: "#9A512A", paper: "#F7F2E8", moss: "#446353", line: "#D9D0BF", gold: "#D9A441" };

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.paper },
  listContent: { padding: 14, paddingBottom: 40 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: colors.paper },
  hero: { flexDirection: "row", backgroundColor: colors.ink, borderRadius: 20, padding: 18, marginBottom: 12, overflow: "hidden" },
  heroCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: "#E3BD71", fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  heroTitle: { color: "#FFF9EC", fontSize: 25, fontWeight: "800", marginTop: 5 },
  heroText: { color: "#D8DDD8", fontSize: 13, lineHeight: 18, marginTop: 7 },
  countBadge: { alignSelf: "center", alignItems: "center", justifyContent: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: colors.clay },
  countValue: { color: "white", fontSize: 23, fontWeight: "900" },
  countLabel: { color: "#F8D9C9", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modeRow: { flexDirection: "row", gap: 7, marginBottom: 10 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: "#FFFDF8" },
  modeButtonActive: { backgroundColor: colors.moss, borderColor: colors.moss },
  modeButtonText: { color: colors.ink, fontWeight: "700" },
  modeButtonTextActive: { color: "white" },
  includeResolvedRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2 },
  includeResolvedBox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.clay, borderRadius: 5, backgroundColor: "#FFFDF8" },
  includeResolvedBoxActive: { backgroundColor: colors.clay },
  includeResolvedMark: { color: "white", fontWeight: "900" },
  includeResolvedLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  refreshButton: { paddingHorizontal: 14, justifyContent: "center", borderRadius: 10, backgroundColor: "#E9DFCE" },
  refreshButtonText: { color: colors.ink, fontWeight: "700" },
  searchInput: { backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, marginBottom: 9 },
  filterBlock: { marginBottom: 7 },
  filterLabel: { color: "#766E61", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 4 },
  filterStrip: { gap: 6, paddingRight: 8 },
  filterChip: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#FFFDF8" },
  filterChipActive: { backgroundColor: colors.clay, borderColor: colors.clay },
  filterChipText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: "white" },
  message: { color: colors.moss, fontWeight: "700", marginVertical: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#E8DECB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, marginBottom: 6 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  sectionCount: { color: "white", backgroundColor: colors.clay, minWidth: 24, textAlign: "center", borderRadius: 12, overflow: "hidden", fontWeight: "800", paddingVertical: 2 },
  orderCard: { flexDirection: "row", backgroundColor: "#FFFDF8", borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: "hidden", marginBottom: 8 },
  orderStripe: { width: 7, backgroundColor: colors.clay },
  resolvedStripe: { backgroundColor: colors.moss },
  progressStripe: { backgroundColor: colors.gold },
  partsStripe: { backgroundColor: "#547D88" },
  orderBody: { flex: 1, padding: 12 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  orderLocation: { color: colors.moss, fontSize: 12, fontWeight: "900" },
  orderAge: { color: "#777166", fontSize: 11 },
  orderTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 5 },
  orderAudit: { color: "#777166", fontSize: 10, marginTop: 2 },
  orderDescription: { color: "#544F47", fontSize: 13, lineHeight: 18, marginTop: 4 },
  orderFooter: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 9 },
  scopeBadge: { color: colors.clay, backgroundColor: "#F3E1D5", fontSize: 10, fontWeight: "900", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, overflow: "hidden" },
  statusLabel: { color: colors.moss, fontSize: 10, fontWeight: "900" },
  statusLabelResolved: { color: colors.clay },
  updateCount: { color: "#777166", fontSize: 10, marginLeft: "auto" },
  latestLine: { color: "#746B5E", fontSize: 11, fontStyle: "italic", marginTop: 7 },
  empty: { padding: 28, alignItems: "center" },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  emptyText: { color: "#777166", textAlign: "center", lineHeight: 20, marginTop: 6 },
  modalKeyboardAvoider: { flex: 1 },
  modalScrim: { flex: 1, backgroundColor: "rgba(28,34,30,0.58)", justifyContent: "flex-end" },
  modalScrimKeyboard: { justifyContent: "flex-start", paddingTop: 8 },
  modalCard: { maxHeight: "92%", backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalCardKeyboard: { flex: 1, maxHeight: "100%" },
  modalScrollKeyboard: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 36 },
  modalEyebrow: { color: colors.clay, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  modalTitle: { color: colors.ink, fontSize: 27, fontWeight: "900", marginTop: 5 },
  modalMeta: { color: colors.moss, fontWeight: "800", marginTop: 5 },
  auditLine: { color: "#777166", fontSize: 11, marginTop: 3 },
  modalDescription: { color: "#48453E", fontSize: 15, lineHeight: 21, backgroundColor: "#FFFDF8", borderRadius: 12, padding: 12, marginTop: 12 },
  threadTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 20, marginBottom: 7 },
  threadEntry: { borderLeftWidth: 3, borderLeftColor: colors.gold, paddingLeft: 10, paddingVertical: 6, marginBottom: 6 },
  threadType: { color: colors.clay, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  threadText: { color: colors.ink, fontSize: 14, lineHeight: 19, marginTop: 3 },
  modalMessage: { color: colors.moss, fontSize: 14, fontWeight: "800", marginTop: 14 },
  resolvedNotice: { backgroundColor: "#E8DECB", borderRadius: 12, padding: 12, marginTop: 16 },
  resolvedNoticeTitle: { color: colors.clay, fontSize: 15, fontWeight: "900" },
  resolvedNoticeText: { color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 3 },
  composerTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 20, marginBottom: 8 },
  entryTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  noteInput: { minHeight: 92, textAlignVertical: "top", backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, marginTop: 9 },
  resolvedCheckRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 12 },
  resolvedCheckBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.clay, borderRadius: 5, backgroundColor: "#FFFDF8" },
  resolvedCheckBoxActive: { backgroundColor: colors.clay },
  resolvedCheckMark: { color: "white", fontWeight: "900" },
  resolvedCheckLabel: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  resolutionInput: { minHeight: 68, textAlignVertical: "top", backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink },
  primaryButton: { backgroundColor: colors.moss, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 9 },
  primaryButtonText: { color: "white", fontWeight: "900" },
  disabledButton: { opacity: 0.45 },
  resolveButton: { borderWidth: 1, borderColor: colors.clay, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 9 },
  resolveButtonText: { color: colors.clay, fontWeight: "900" },
  closeButton: { padding: 14, alignItems: "center", marginTop: 5 },
  closeButtonText: { color: "#6B665C", fontWeight: "700" },
});
