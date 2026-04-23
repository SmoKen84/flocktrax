import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  DashboardSettings,
  FarmGroupOption,
  FarmOption,
  PlacementFilterMeta,
  PlacementSummary,
} from "../types";
import { formatDateByPattern, formatShortDate } from "../utils/date-format";

type Props = {
  filters: PlacementFilterMeta | null;
  loading: boolean;
  placements: PlacementSummary[];
  settings: DashboardSettings | null;
  selectedFarmId: string | null;
  selectedFarmGroupId: string | null;
  onOpenFeedTicket: () => void;
  onRefresh: () => void;
  onOpenPlacement: (placement: PlacementSummary) => void;
  onLogout: () => void;
  onSelectFarm: (farmId: string | null) => void;
  onSelectFarmGroup: (farmGroupId: string | null) => void;
};

type PickerState =
  | { type: "farm-group"; title: string; options: FarmGroupOption[] }
  | { type: "farm"; title: string; options: FarmOption[] }
  | null;

export function DashboardScreen({
  filters,
  loading,
  placements,
  settings,
  selectedFarmId,
  selectedFarmGroupId,
  onOpenFeedTicket,
  onRefresh,
  onOpenPlacement,
  onLogout,
  onSelectFarm,
  onSelectFarmGroup,
}: Props) {
  const [search, setSearch] = useState("");
  const [pickerState, setPickerState] = useState<PickerState>(null);

  const availableFarmGroups = filters?.available_farm_groups ?? [];
  const selectedFarmGroupName =
    availableFarmGroups.find((item) => item.farm_group_id === selectedFarmGroupId)
      ?.farm_group_name ?? (selectedFarmGroupId ? "Selected group" : "All farm groups");

  const availableFarms = useMemo(() => {
    const farms = filters?.available_farms ?? [];
    if (!selectedFarmGroupId) return farms;
    return farms.filter((farm) => farm.farm_group_id === selectedFarmGroupId);
  }, [filters, selectedFarmGroupId]);

  const selectedFarmName =
    availableFarms.find((farm) => farm.farm_id === selectedFarmId)?.farm_name ??
    "All farms";

  const filteredPlacements = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return placements.filter((item) => {
      if (selectedFarmGroupId && item.farm_group_id !== selectedFarmGroupId) {
        return false;
      }
      if (selectedFarmId && item.farm_id !== selectedFarmId) {
        return false;
      }
      if (!normalized) {
        return true;
      }

      return [item.farm_name, item.barn_code, item.placement_code]
        .filter(Boolean)
        .some((part) => part.toLowerCase().includes(normalized));
    });
  }, [placements, search, selectedFarmGroupId, selectedFarmId]);

  function openFarmGroupPicker() {
    if (!filters?.can_select_farm_group || availableFarmGroups.length <= 1) {
      return;
    }

    setPickerState({
      type: "farm-group",
      title: "Select Farm Group",
      options: availableFarmGroups,
    });
  }

  function openFarmPicker() {
    setPickerState({
      type: "farm",
      title: "Select Farm",
      options: availableFarms,
    });
  }

  function chooseFarmGroup(option: FarmGroupOption) {
    onSelectFarm(null);
    setPickerState(null);
    onSelectFarmGroup(option.farm_group_id);
  }

  function chooseFarm(option: FarmOption | null) {
    onSelectFarm(option?.farm_id ?? null);
    setPickerState(null);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.filterRow}>
        <CompactFilterButton
          disabled={!filters?.can_select_farm_group || availableFarmGroups.length <= 1}
          label="Farm Group"
          value={selectedFarmGroupName}
          onPress={openFarmGroupPicker}
        />
        <CompactFilterButton
          disabled={availableFarms.length <= 1}
          label="Farm"
          value={selectedFarmName}
          onPress={openFarmPicker}
        />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="Search farm, barn, or flock"
          placeholderTextColor="#9A988F"
          style={styles.searchInput}
          value={search}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onLogout} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Back</Text>
        </Pressable>
        <Pressable onPress={onRefresh} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Refresh</Text>
        </Pressable>
        <Pressable onPress={onOpenFeedTicket} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Feed Ticket</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#8B572A" />
          <Text style={styles.loadingText}>Loading active placements...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filteredPlacements}
          keyExtractor={(item) => item.placement_id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenPlacement(item)} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardBarn}>{item.barn_code}</Text>
                  <Text style={styles.cardFarm}>{item.farm_name}</Text>
                  <Text style={styles.cardGroup}>
                    {item.farm_group_name ?? "Assigned Group"}
                  </Text>
                </View>

                <View style={styles.cardStatusStack}>
                  <Text style={styles.cardDate}>
                    {formatShortDate(item.placed_date, settings?.short_date)}
                  </Text>
                  <View style={[styles.statusBadge, badgeStyle(item)]}>
                    <Text style={[styles.statusText, badgeTextStyle(item)]}>
                      {badgeLabel(item)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardMetricsRow}>
                <MetricCell value={item.placement_code} />
                <MetricCell value={`${item.age_days ?? "--"} days`} align="center" />
              </View>

              <View style={styles.cardBirdCountBlock}>
                <Text style={styles.cardBirdCount}>{formatCount(item.current_total_count)}</Text>
                <View style={styles.cardBirdBreakdown}>
                  <View style={styles.cardBirdBreakdownRow}>
                    <Text style={styles.cardBirdCount}>{formatCount(item.current_male_count)}</Text>
                    <Text style={styles.cardBirdBreakdownLabel}>Males</Text>
                  </View>
                  <View style={styles.cardBirdBreakdownRow}>
                    <Text style={styles.cardBirdCount}>{formatCount(item.current_female_count)}</Text>
                    <Text style={styles.cardBirdBreakdownLabel}>Females</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.cardBirdMeta}>
                <Text style={styles.cardBirdMetaAccent}>
                  {formatDateByPattern(item.est_first_catch, settings?.dow_date, "not scheduled")}
                </Text>
                {" "}Estimated First Livehaul{" "}
                <Text style={styles.cardBirdMetaAccent}>
                  ({item.first_livehaul_days ?? "--"} days)
                </Text>
              </Text>
              <Text style={styles.cardHint}>
                Tap to open and collect data for this barn
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {search.trim()
                  ? "No placements match this search."
                  : selectedFarmGroupId
                    ? "No active placements returned for this farm group."
                    : "No active placements returned."}
              </Text>
              <Text style={styles.emptyCopy}>
                {search.trim()
                  ? "Try a farm name, barn code, or placement code."
                  : selectedFarmGroupId
                    ? "This farm group currently has no active placement records to display."
                    : "Once this user is tied to live placements, each tile here should represent an active barn assignment."}
              </Text>
            </View>
          }
        />
      )}

      <SelectionModal
        pickerState={pickerState}
        selectedFarmGroupId={selectedFarmGroupId}
        selectedFarmId={selectedFarmId}
        onChooseFarm={chooseFarm}
        onChooseFarmGroup={chooseFarmGroup}
        onClose={() => setPickerState(null)}
      />
    </View>
  );
}

type CompactFilterButtonProps = {
  disabled?: boolean;
  label: string;
  value: string;
  onPress: () => void;
};

function CompactFilterButton({
  disabled = false,
  label,
  value,
  onPress,
}: CompactFilterButtonProps) {
  return (
    <View style={styles.compactFilterBlock}>
      <Text style={styles.compactFilterLabel}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[styles.compactFilterButton, disabled && styles.filterButtonDisabled]}
      >
        <Text
          numberOfLines={1}
          style={[styles.compactFilterValue, disabled && styles.filterButtonTextDisabled]}
        >
          {value}
        </Text>
        <View style={[styles.ellipsisButton, disabled && styles.ellipsisButtonDisabled]}>
          <Text style={styles.ellipsisButtonText}>...</Text>
        </View>
      </Pressable>
    </View>
  );
}

type MetricCellProps = {
  value: string;
  align?: "left" | "center";
};

function MetricCell({ value, align = "left" }: MetricCellProps) {
  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricValue, align === "center" && styles.metricValueCenter]}>
        {value}
      </Text>
    </View>
  );
}

type SelectionModalProps = {
  pickerState: PickerState;
  selectedFarmGroupId: string | null;
  selectedFarmId: string | null;
  onChooseFarm: (option: FarmOption | null) => void;
  onChooseFarmGroup: (option: FarmGroupOption) => void;
  onClose: () => void;
};

function SelectionModal({
  pickerState,
  selectedFarmGroupId,
  selectedFarmId,
  onChooseFarm,
  onChooseFarmGroup,
  onClose,
}: SelectionModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={pickerState !== null}
      onRequestClose={onClose}
    >
      <View style={styles.modalScrim}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{pickerState?.title}</Text>

          {pickerState?.type === "farm-group"
            ? pickerState.options.map((option) => (
                <Pressable
                  key={option.farm_group_id}
                  onPress={() => onChooseFarmGroup(option)}
                  style={[
                    styles.modalOption,
                    option.farm_group_id === selectedFarmGroupId && styles.modalOptionSelected,
                  ]}
                >
                  <Text style={styles.modalOptionText}>{option.farm_group_name}</Text>
                </Pressable>
              ))
            : null}

          {pickerState?.type === "farm" ? (
            <>
              <Pressable
                onPress={() => onChooseFarm(null)}
                style={[styles.modalOption, selectedFarmId === null && styles.modalOptionSelected]}
              >
                <Text style={styles.modalOptionText}>All farms</Text>
              </Pressable>
              {pickerState.options.map((option) => (
                <Pressable
                  key={option.farm_id}
                  onPress={() => onChooseFarm(option)}
                  style={[
                    styles.modalOption,
                    option.farm_id === selectedFarmId && styles.modalOptionSelected,
                  ]}
                >
                  <Text style={styles.modalOptionText}>{option.farm_name}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          <Pressable onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function badgeLabel(item: PlacementSummary) {
  if (item.dashboard_status_label) return item.dashboard_status_label;
  if (!item.is_active) return "Inactive";
  if (item.is_complete) return "Complete";
  return "Needs R&M";
}

function badgeStyle(item: PlacementSummary) {
  if (item.dashboard_status_tone === "danger") return styles.badgeDanger;
  if (item.dashboard_status_tone === "good") return styles.badgeComplete;
  if (item.dashboard_status_tone === "neutral") return styles.badgeInactive;
  if (item.dashboard_status_tone === "warn") return styles.badgeAttention;
  if (!item.is_active) return styles.badgeInactive;
  if (item.is_complete) return styles.badgeComplete;
  return styles.badgeAttention;
}

function badgeTextStyle(item: PlacementSummary) {
  if (item.dashboard_status_tone === "danger") return styles.badgeDangerText;
  if (item.dashboard_status_tone === "good") return styles.badgeCompleteText;
  if (item.dashboard_status_tone === "neutral") return styles.badgeInactiveText;
  if (item.dashboard_status_tone === "warn") return styles.badgeAttentionText;
  if (!item.is_active) return styles.badgeInactiveText;
  if (item.is_complete) return styles.badgeCompleteText;
  return styles.badgeAttentionText;
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number") return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: 6,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  compactFilterBlock: {
    flex: 1,
    gap: 4,
  },
  compactFilterLabel: {
    color: "#8C897E",
    fontSize: 10,
    fontWeight: "700",
  },
  compactFilterButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0D4C3",
    backgroundColor: "#FFFDFC",
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterButtonDisabled: {
    backgroundColor: "#F1ECE4",
  },
  compactFilterValue: {
    flex: 1,
    color: "#4E5550",
    fontSize: 13,
    fontWeight: "600",
  },
  filterButtonTextDisabled: {
    color: "#6B6C68",
  },
  ellipsisButton: {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4EBDD",
    marginLeft: 8,
  },
  ellipsisButtonDisabled: {
    backgroundColor: "#E7E1D8",
  },
  ellipsisButtonText: {
    color: "#7A4A21",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 14,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
    fontSize: 13,
    color: "#4E5550",
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: "#73491F",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  listContent: {
    gap: 14,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeaderCopy: {
    flex: 1,
  },
  cardBarn: {
    color: "#A01828",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 29,
  },
  cardFarm: {
    color: "#A01828",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 21,
  },
  cardGroup: {
    color: "#54493F",
    fontSize: 14,
    fontWeight: "500",
  },
  cardStatusStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  cardDate: {
    color: "#929189",
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeAttention: {
    backgroundColor: "#FFE72A",
  },
  badgeComplete: {
    backgroundColor: "#D7E7C9",
  },
  badgeDanger: {
    backgroundColor: "#E53D36",
  },
  badgeInactive: {
    backgroundColor: "#E5D9D4",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  badgeAttentionText: {
    color: "#2F2B19",
  },
  badgeCompleteText: {
    color: "#3E6031",
  },
  badgeDangerText: {
    color: "#FFF8EF",
  },
  badgeInactiveText: {
    color: "#77534A",
  },
  cardMetricsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  metricCell: {
    justifyContent: "center",
    minHeight: 22,
  },
  metricValue: {
    color: "#223224",
    fontSize: 22,
    fontWeight: "800",
  },
  metricValueCenter: {
    textAlign: "center",
  },
  cardBirdCount: {
    color: "#A01828",
    fontSize: 16,
    fontWeight: "700",
  },
  cardBirdCountBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardBirdBreakdown: {
    flex: 1,
    gap: 2,
    paddingTop: 1,
  },
  cardBirdBreakdownRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  cardBirdBreakdownLabel: {
    color: "#1F2A1F",
    fontSize: 15,
    fontWeight: "500",
  },
  cardBirdMeta: {
    color: "#6A5643",
    fontSize: 14,
    fontWeight: "600",
  },
  cardBirdMetaAccent: {
    color: "#8F1F23",
    fontWeight: "800",
  },
  cardHint: {
    color: "#9E6330",
    fontSize: 14,
    fontWeight: "800",
    fontStyle: "italic",
    marginTop: 4,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#556255",
    fontSize: 15,
    fontWeight: "600",
  },
  empty: {
    borderRadius: 20,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#D8C9B2",
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: "#1F2A1F",
    fontSize: 19,
    fontWeight: "800",
  },
  emptyCopy: {
    color: "#556255",
    fontSize: 14,
    lineHeight: 20,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    color: "#1F2A1F",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCC9AF",
    backgroundColor: "#FFFDFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalOptionSelected: {
    backgroundColor: "#F3E8D8",
    borderColor: "#CFAE82",
  },
  modalOptionText: {
    color: "#4A4D47",
    fontSize: 15,
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#8B572A",
  },
  modalCloseText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
});
