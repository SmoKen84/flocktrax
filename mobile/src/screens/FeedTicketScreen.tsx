import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FeedBinOption, FeedDropEntry, FeedTicketItem } from "../types";

type Props = {
  item: FeedTicketItem | null;
  loading: boolean;
  onBack: () => void;
  onSave: (item: FeedTicketItem) => Promise<void>;
};

type PickerState =
  | { type: "farm" }
  | { type: "barn"; farmId: string | null }
  | { type: "bin"; farmId: string | null; barnId: string | null }
  | null;

type PendingDropState = {
  farmId: string | null;
  barnId: string | null;
  feed_bin_id: string | null;
  drop_weight_lbs: number | null;
  feed_type: string | null;
  note: string | null;
};

type PickerOption = {
  id: string;
  title: string;
  copy?: string;
  meta?: string;
};

const serifFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });
const FEED_TYPES = ["Starter", "Grower", "Other"] as const;
const TICKET_FEED_TYPES = ["Starter", "Grower", "Split"] as const;

export function FeedTicketScreen({ item, loading, onBack, onSave }: Props) {
  const [draft, setDraft] = useState<FeedTicketItem | null>(item);
  const [ticketStarted, setTicketStarted] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<PendingDropState>(buildPendingDrop());
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => getMonthStart(item?.delivered_at ?? new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  useEffect(() => {
    setDraft(item);
    setTicketStarted(Boolean(item?.id));
    setPendingDrop(buildPendingDrop());
    setPickerState(null);
    setIsCalendarOpen(false);
    setCalendarCursor(getMonthStart(item?.delivered_at ?? new Date().toISOString()));
    setMessage(null);
    setMessageTone("error");
    setHasUnsavedChanges(false);
    setShowUnsavedModal(false);
  }, [item]);

  const droppedTotal = useMemo(() => {
    if (!draft) return 0;
    return draft.drops.reduce((sum, drop) => sum + (drop.drop_weight_lbs ?? 0), 0);
  }, [draft]);

  const remainingWeight = useMemo(() => {
    if (draft?.ticket_weight_lbs === null || draft?.ticket_weight_lbs === undefined) return 0;
    return draft.ticket_weight_lbs - droppedTotal;
  }, [draft, droppedTotal]);

  const selectedFarm = useMemo(
    () => draft?.bins.find((bin) => bin.farm_id === pendingDrop.farmId) ?? null,
    [draft, pendingDrop.farmId],
  );

  const selectedBarn = useMemo(
    () => draft?.bins.find((bin) => bin.barn_id === pendingDrop.barnId) ?? null,
    [draft, pendingDrop.barnId],
  );

  const selectedBin = useMemo(
    () => draft?.bins.find((bin) => bin.feed_bin_id === pendingDrop.feed_bin_id) ?? null,
    [draft, pendingDrop.feed_bin_id],
  );

  async function handlePrimaryAction() {
    if (!draft) return;

    if (!ticketStarted) {
      const validation = validateTicketHeader(draft);
      if (validation) {
        setMessageTone("error");
        setMessage(validation);
        return;
      }

      setTicketStarted(true);
      setHasUnsavedChanges(true);
      setMessageTone("success");
      setMessage("Ticket started. Add each drop, then save the balanced ticket.");
      return;
    }

    const validation = validateFinalSave(draft, remainingWeight, pendingDrop);
    if (validation) {
      setMessageTone("error");
      setMessage(validation);
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      await onSave(draft);
      setMessageTone("success");
      setMessage("Feed ticket and drops saved.");
      setHasUnsavedChanges(false);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Feed ticket save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveDrop() {
    if (!draft) return;

    const validation = validatePendingDrop(pendingDrop, selectedBin);
    if (validation) {
      setMessageTone("error");
      setMessage(validation);
      return;
    }

    const nextDrop: FeedDropEntry = {
      id: null,
      feed_bin_id: selectedBin?.feed_bin_id ?? null,
      bin_code: selectedBin?.bin_code ?? null,
      barn_code: selectedBin?.barn_code ?? null,
      placement_id: selectedBin?.active_placement_id ?? null,
      placement_code: selectedBin?.active_placement_code ?? null,
      feed_type: pendingDrop.feed_type,
      drop_weight_lbs: pendingDrop.drop_weight_lbs,
      note: pendingDrop.note,
      drop_order: draft.drops.length + 1,
    };

    setDraft({
      ...draft,
      drops: [...draft.drops, nextDrop],
    });
    setHasUnsavedChanges(true);
    setPendingDrop(buildPendingDrop());
    setMessageTone("success");
    setMessage("Drop added to this ticket.");
  }

  function handleRemoveDrop(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      drops: draft.drops
        .filter((_, currentIndex) => currentIndex !== index)
        .map((drop, currentIndex) => ({ ...drop, drop_order: currentIndex + 1 })),
    });
    setHasUnsavedChanges(true);
  }

  function handleBackPress() {
    if (hasUnsavedChanges) {
      setShowUnsavedModal(true);
      return;
    }
    onBack();
  }

  if (loading && !draft) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#8B572A" />
        <Text style={styles.loadingText}>Loading feed ticket...</Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>No feed ticket loaded.</Text>
        <Pressable onPress={onBack} style={styles.backButtonSolo}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const pickerOptions = buildPickerOptions(draft.bins, pickerState);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", default: undefined })}
      style={styles.screen}
    >
      <View style={styles.topBar}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={handlePrimaryAction}
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF8EF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {ticketStarted ? "Save Ticket & Drops" : "Start Ticket"}
            </Text>
          )}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenKicker}>Field Operations</Text>
        <Text style={styles.screenTitle}>Create Ticket & Receive Feed</Text>

        {message ? (
          <View style={[styles.messageBanner, messageTone === "success" ? styles.messageSuccess : styles.messageError]}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {!ticketStarted ? (
          <View style={styles.card}>
            <View style={styles.gridTwo}>
                <LabeledField
                  label="Ticket Number"
                  value={draft.ticket_number}
                  onChange={(value) => {
                    setDraft({ ...draft, ticket_number: value || null });
                    setHasUnsavedChanges(true);
                  }}
                />
              <View style={styles.labeledField}>
                <Text style={styles.inlineLabel}>Date</Text>
                <Pressable onPress={() => setIsCalendarOpen(true)} style={styles.dateButton}>
                  <Text style={styles.dateButtonText}>{formatDateInput(draft.delivered_at) || "Select Date"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.gridTwo}>
                <LabeledField
                  label="Feedmill"
                  value={draft.vendor_name}
                  onChange={(value) => {
                    setDraft({ ...draft, vendor_name: value || null });
                    setHasUnsavedChanges(true);
                  }}
                />
                <LabeledField
                  label="Net Weight"
                  keyboardType="decimal-pad"
                  value={draft.ticket_weight_lbs}
                  onChange={(value) => {
                    setDraft({ ...draft, ticket_weight_lbs: toNullableNumber(value) });
                    setHasUnsavedChanges(true);
                  }}
                />
            </View>

            <View style={styles.feedTypeRow}>
              {TICKET_FEED_TYPES.map((type) => (
                <FeedTypeToggle
                  key={type}
                  label={type}
                  checked={normalizeFeedType(draft.source_type) === type}
                  onPress={() =>
                    {
                      setDraft({
                        ...draft,
                        source_type: type,
                        feed_name: draft.feed_name || type,
                      });
                      setHasUnsavedChanges(true);
                    }
                  }
                />
              ))}
            </View>

            <LabeledField
              label="Comment"
              multiline
              value={draft.note}
              onChange={(value) => {
                setDraft({ ...draft, note: value || null });
                setHasUnsavedChanges(true);
              }}
            />
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLabel}>Ticket Number</Text>
                  <Text style={styles.ticketNumber}>{draft.ticket_number?.trim() || "--"}</Text>
                  <Text style={styles.summaryDate}>{formatDisplayDate(draft.delivered_at)}</Text>
                  {draft.note ? (
                    <Text numberOfLines={2} style={styles.summaryNote}>
                      {draft.note}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.summaryRight}>
                  <Text style={styles.summaryLabelRight}>Feed Received</Text>
                  <Text style={styles.summaryWeight}>{formatWeight(draft.ticket_weight_lbs)}</Text>
                  <Text style={styles.summaryType}>
                    {(draft.feed_name || draft.source_type || "Load").toUpperCase()}
                  </Text>
                  <Text style={styles.summaryMill}>{draft.vendor_name || "--"}</Text>
                </View>
              </View>

              <View style={styles.rollupRow}>
                <Text style={styles.rollupText}>Drops: {draft.drops.length}</Text>
                <Text style={styles.rollupText}>
                  Not Allocated: <Text style={styles.rollupAccent}>{formatWeight(remainingWeight)}</Text>
                </Text>
              </View>

              <View style={styles.dropTable}>
                <View style={styles.dropTableHeader}>
                  <Text style={[styles.dropTableHeaderText, styles.dropColBin]}>Bin</Text>
                  <Text style={[styles.dropTableHeaderText, styles.dropColFlock]}>Flock</Text>
                  <Text style={[styles.dropTableHeaderText, styles.dropColType]}>Type</Text>
                  <Text style={[styles.dropTableHeaderText, styles.dropColAmt]}>Amount</Text>
                  <View style={styles.dropTableHeaderSpacer} />
                </View>
                {draft.drops.length ? (
                  draft.drops.map((drop, index) => (
                    <View key={`${drop.id ?? "draft"}-${index}`} style={styles.dropTableRow}>
                      <Text style={[styles.dropTableValue, styles.dropColBin]}>{drop.bin_code || "--"}</Text>
                      <Text style={[styles.dropTableValue, styles.dropColFlock]}>{drop.placement_code || "--"}</Text>
                      <Text style={[styles.dropTableValue, styles.dropColType]}>{toFeedShortLabel(drop.feed_type)}</Text>
                      <Text style={[styles.dropTableValue, styles.dropColAmt]}>{formatWeight(drop.drop_weight_lbs)}</Text>
                      <Pressable onPress={() => handleRemoveDrop(index)} style={styles.dropRemoveChip}>
                        <Text style={styles.dropRemoveText}>X</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyDropText}>No drops added yet.</Text>
                )}
              </View>
            </View>

            <Pressable onPress={handleSaveDrop} style={styles.addDropPill}>
              <Text style={styles.addDropPillText}>Save Drop</Text>
            </Pressable>

            <View style={styles.card}>
              <View style={styles.binDropsHeader}>
                <Text style={styles.binDropsTitle}>Bin Drops</Text>
                <Text style={styles.binDropsCount}># {draft.drops.length + 1}</Text>
              </View>
              <View style={styles.innerPanel}>
                <View style={styles.gridThree}>
                  <StepSelectButton
                    label="Farm"
                    value={selectedFarm?.farm_name || "Select"}
                    onPress={() => setPickerState({ type: "farm" })}
                  />
                  <StepSelectButton
                    label="Barn"
                    value={selectedBarn?.barn_code || "Select"}
                    onPress={() => setPickerState({ type: "barn", farmId: pendingDrop.farmId })}
                  />
                  <StepSelectButton
                    label="Bin"
                    value={selectedBin?.bin_code || "Select"}
                    valueTone={selectedBin ? "value" : "danger"}
                    onPress={() =>
                      setPickerState({
                        type: "bin",
                        farmId: pendingDrop.farmId,
                        barnId: pendingDrop.barnId,
                      })
                    }
                  />
                </View>

                <View style={styles.dropBodyRow}>
                  <View style={styles.dropTypeColumn}>
                    {FEED_TYPES.map((type) => (
                      <FeedTypeToggle
                        key={type}
                        compact
                        label={type}
                        checked={normalizeFeedType(pendingDrop.feed_type) === type}
                        onPress={() => {
                          setPendingDrop((current) => ({ ...current, feed_type: type }));
                          setHasUnsavedChanges(true);
                        }}
                      />
                    ))}
                  </View>

                  <View style={styles.dropAmountColumn}>
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(value) =>
                        {
                          setPendingDrop((current) => ({
                            ...current,
                            drop_weight_lbs: toNullableNumber(value),
                          }));
                          setHasUnsavedChanges(true);
                        }
                      }
                      placeholder="0"
                      placeholderTextColor="#AEA18D"
                      style={styles.amountInput}
                      value={
                        pendingDrop.drop_weight_lbs === null || pendingDrop.drop_weight_lbs === undefined
                          ? ""
                          : String(pendingDrop.drop_weight_lbs)
                      }
                    />
                    <Text style={styles.amountLabel}>Drop Pounds</Text>
                  </View>
                </View>

                <Text style={styles.pendingPlacement}>
                  {selectedBin?.active_placement_code
                    ? `Active flock ${selectedBin.active_placement_code}`
                    : "Bin must resolve to an active flock before the drop can be saved."}
                </Text>

                <LabeledField
                  label="Drop Comment"
                  value={pendingDrop.note}
                  onChange={(value) => {
                    setPendingDrop((current) => ({ ...current, note: value || null }));
                    setHasUnsavedChanges(true);
                  }}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setPickerState(null)} transparent visible={pickerState !== null}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerOptions.title}</Text>
            <ScrollView contentContainerStyle={styles.modalList}>
              {pickerOptions.items.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    applyPickerSelection(option.id, draft.bins, setPendingDrop, pickerState);
                    setHasUnsavedChanges(true);
                    setPickerState(null);
                  }}
                  style={styles.modalOption}
                >
                  <Text style={styles.modalOptionTitle}>{option.title}</Text>
                  {option.copy ? <Text style={styles.modalOptionCopy}>{option.copy}</Text> : null}
                  {option.meta ? <Text style={styles.modalOptionMeta}>{option.meta}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPickerState(null)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <CalendarModal
        currentDate={toIsoDateOnly(draft.delivered_at)}
        cursor={calendarCursor}
        visible={isCalendarOpen}
        onChangeCursor={setCalendarCursor}
        onClose={() => setIsCalendarOpen(false)}
        onSelectDate={(nextDate) => {
          setDraft({ ...draft, delivered_at: toIsoDateAtNoon(nextDate) });
          setHasUnsavedChanges(true);
          setIsCalendarOpen(false);
        }}
      />

      <UnsavedChangesModal
        visible={showUnsavedModal}
        onCancel={() => setShowUnsavedModal(false)}
        onDisregard={() => {
          setShowUnsavedModal(false);
          setHasUnsavedChanges(false);
          onBack();
        }}
        onSave={async () => {
          setShowUnsavedModal(false);
          const saved = await trySaveFeedTicket(draft, remainingWeight, pendingDrop, setSaving, setMessage, setMessageTone, onSave);
          if (!saved) return;
          setHasUnsavedChanges(false);
          onBack();
        }}
      />
    </KeyboardAvoidingView>
  );
}

function buildPendingDrop(): PendingDropState {
  return {
    farmId: null,
    barnId: null,
    feed_bin_id: null,
    drop_weight_lbs: null,
    feed_type: null,
    note: null,
  };
}

function validateTicketHeader(draft: FeedTicketItem) {
  if (!draft.ticket_number?.trim()) return "Ticket number is required.";
  if (!draft.delivered_at) return "Date is required.";
  if (!draft.vendor_name?.trim()) return "Feedmill is required.";
  if (!draft.ticket_weight_lbs || draft.ticket_weight_lbs <= 0) return "Net weight must be greater than zero.";
  if (!draft.source_type?.trim()) return "Choose Starter, Grower, or Other.";
  return null;
}

function validatePendingDrop(drop: PendingDropState, bin: FeedBinOption | null) {
  if (!drop.farmId) return "Select a farm for this drop.";
  if (!drop.barnId) return "Select a barn for this drop.";
  if (!drop.feed_bin_id || !bin) return "Select a bin for this drop.";
  if (!bin.active_placement_id) return "That bin does not have an active flock assignment.";
  if (!drop.feed_type?.trim()) return "Choose the feed type for this drop.";
  if (!drop.drop_weight_lbs || drop.drop_weight_lbs <= 0) return "Drop pounds must be greater than zero.";
  return null;
}

function validateFinalSave(
  draft: FeedTicketItem,
  remainingWeight: number,
  pendingDrop: PendingDropState,
) {
  const ticketValidation = validateTicketHeader(draft);
  if (ticketValidation) return ticketValidation;
  if (!draft.drops.length) return "Add at least one saved drop before finishing the ticket.";
  if (hasPendingDropContent(pendingDrop)) return "Save or clear the current drop before finishing the ticket.";
  if (Math.abs(remainingWeight) > 0.01) return "Ticket must be fully allocated before it can be saved.";
  return null;
}

async function trySaveFeedTicket(
  draft: FeedTicketItem,
  remainingWeight: number,
  pendingDrop: PendingDropState,
  setSaving: Dispatch<SetStateAction<boolean>>,
  setMessage: Dispatch<SetStateAction<string | null>>,
  setMessageTone: Dispatch<SetStateAction<"error" | "success">>,
  onSave: (item: FeedTicketItem) => Promise<void>,
) {
  const validation = validateFinalSave(draft, remainingWeight, pendingDrop);
  if (validation) {
    setMessageTone("error");
    setMessage(validation);
    return false;
  }

  try {
    setSaving(true);
    setMessage(null);
    await onSave(draft);
    setMessageTone("success");
    setMessage("Feed ticket and drops saved.");
    return true;
  } catch (error) {
    setMessageTone("error");
    setMessage(error instanceof Error ? error.message : "Feed ticket save failed.");
    return false;
  } finally {
    setSaving(false);
  }
}

function hasPendingDropContent(drop: PendingDropState) {
  return Boolean(
    drop.farmId || drop.barnId || drop.feed_bin_id || drop.drop_weight_lbs || drop.feed_type || drop.note?.trim(),
  );
}

function buildPickerOptions(bins: FeedBinOption[], pickerState: PickerState) {
  if (!pickerState) {
    return { title: "", items: [] as PickerOption[] };
  }

  if (pickerState.type === "farm") {
    const items = bins.reduce<PickerOption[]>((acc, bin) => {
      if (!acc.some((item) => item.id === bin.farm_id)) {
        acc.push({ id: bin.farm_id, title: bin.farm_name || "Farm" });
      }
      return acc;
    }, []);
    return { title: "Select Farm", items };
  }

  if (pickerState.type === "barn") {
    const items = bins
      .filter((bin) => !pickerState.farmId || bin.farm_id === pickerState.farmId)
      .reduce<PickerOption[]>((acc, bin) => {
        if (!acc.some((item) => item.id === bin.barn_id)) {
          acc.push({
            id: bin.barn_id,
            title: bin.barn_code,
            copy: bin.active_placement_code ? `Flock ${bin.active_placement_code}` : (bin.farm_name || undefined),
            meta: bin.farm_name || undefined,
          });
        }
        return acc;
      }, []);
    return { title: "Select Barn", items };
  }

  const items = bins
    .filter(
      (bin) =>
        (!pickerState.farmId || bin.farm_id === pickerState.farmId) &&
        (!pickerState.barnId || bin.barn_id === pickerState.barnId),
    )
    .map((bin) => ({
      id: bin.feed_bin_id,
      title: String(bin.bin_code),
      copy: `${bin.barn_code}   Cap ${formatWeight(bin.capacity_lbs)}`,
      meta: bin.active_placement_code ? "Active flock assigned" : "No active flock assigned",
    }));

  return { title: "Select Bin", items };
}

function applyPickerSelection(
  selectedId: string,
  bins: FeedBinOption[],
  setPendingDrop: Dispatch<SetStateAction<PendingDropState>>,
  pickerState: PickerState,
) {
  if (!pickerState) return;

  if (pickerState.type === "farm") {
    setPendingDrop((current) => ({
      ...current,
      farmId: selectedId,
      barnId: null,
      feed_bin_id: null,
    }));
    return;
  }

  if (pickerState.type === "barn") {
    setPendingDrop((current) => ({
      ...current,
      farmId: pickerState.farmId,
      barnId: selectedId,
      feed_bin_id: null,
    }));
    return;
  }

  const selectedBin = bins.find((bin) => bin.feed_bin_id === selectedId);
  if (!selectedBin) return;

  setPendingDrop((current) => ({
    ...current,
    farmId: selectedBin.farm_id,
    barnId: selectedBin.barn_id,
    feed_bin_id: selectedBin.feed_bin_id,
  }));
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDateInput(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "--";
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function toIsoDateOnly(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value.includes("T")) return value.slice(0, 10);
  return value;
}

function toIsoDateAtNoon(value: string) {
  return `${value}T12:00:00.000Z`;
}

function getMonthStart(value: string) {
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFeedType(value: string | null | undefined) {
  if (!value) return null;
  const match = [...TICKET_FEED_TYPES, ...FEED_TYPES].find(
    (type) => type.toLowerCase() === value.toLowerCase(),
  );
  return match ?? value;
}

function toFeedShortLabel(value: string | null | undefined) {
  const normalized = normalizeFeedType(value);
  if (normalized === "Starter") return "S";
  if (normalized === "Grower") return "G";
  if (normalized === "Other") return "O";
  return "--";
}

type StepSelectButtonProps = {
  label: string;
  value: string;
  valueTone?: "value" | "danger";
  onPress: () => void;
};

function StepSelectButton({ label, value, valueTone = "value", onPress }: StepSelectButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.stepSelectButton}>
      <Text style={styles.stepSelectLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={[styles.stepSelectValue, valueTone === "danger" && styles.stepSelectDanger]}
      >
        {value}
      </Text>
    </Pressable>
  );
}

type FeedTypeToggleProps = {
  label: string;
  checked: boolean;
  compact?: boolean;
  onPress: () => void;
};

function FeedTypeToggle({ label, checked, compact = false, onPress }: FeedTypeToggleProps) {
  return (
    <Pressable onPress={onPress} style={[styles.feedTypeToggle, compact && styles.feedTypeToggleCompact]}>
      <View style={[styles.feedTypeBox, checked && styles.feedTypeBoxChecked]}>
        {checked ? <Text style={styles.feedTypeX}>X</Text> : null}
      </View>
      <Text style={[styles.feedTypeLabel, compact && styles.feedTypeLabelCompact]}>{label}</Text>
    </Pressable>
  );
}

type LabeledFieldProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  multiline?: boolean;
};

function LabeledField({
  label,
  value,
  onChange,
  keyboardType = "default",
  multiline = false,
}: LabeledFieldProps) {
  return (
    <View style={styles.labeledField}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChange}
        placeholderTextColor="#A59A89"
        style={[styles.input, multiline && styles.inputMultiline]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value === null || value === undefined ? "" : String(value)}
      />
    </View>
  );
}

type UnsavedChangesModalProps = {
  visible: boolean;
  onCancel: () => void;
  onDisregard: () => void;
  onSave: () => void;
};

function UnsavedChangesModal({
  visible,
  onCancel,
  onDisregard,
  onSave,
}: UnsavedChangesModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalScrimCenter}>
        <View style={styles.unsavedCard}>
          <Text style={styles.unsavedTitle}>Unsaved Entries</Text>
          <Text style={styles.unsavedCopy}>
            There are unsaved entries on this screen. Save them, disregard them, or cancel and stay here.
          </Text>
          <View style={styles.unsavedActions}>
            <Pressable onPress={onSave} style={styles.unsavedPrimaryButton}>
              <Text style={styles.unsavedPrimaryText}>Save</Text>
            </Pressable>
            <Pressable onPress={onDisregard} style={styles.unsavedSecondaryButton}>
              <Text style={styles.unsavedSecondaryText}>Disregard</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.unsavedGhostButton}>
              <Text style={styles.unsavedGhostText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type CalendarModalProps = {
  currentDate: string;
  cursor: Date;
  visible: boolean;
  onChangeCursor: (next: Date) => void;
  onClose: () => void;
  onSelectDate: (nextDate: string) => void;
};

function CalendarModal({
  currentDate,
  cursor,
  visible,
  onChangeCursor,
  onClose,
  onSelectDate,
}: CalendarModalProps) {
  const days = buildCalendarDays(cursor);
  const currentMonthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalScrimCenter}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => onChangeCursor(addMonths(cursor, -1))} style={styles.calendarArrowButton}>
              <Text style={styles.calendarArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{currentMonthLabel}</Text>
            <Pressable onPress={() => onChangeCursor(addMonths(cursor, 1))} style={styles.calendarArrowButton}>
              <Text style={styles.calendarArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.calendarWeekHeader}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <Text key={label} style={styles.calendarWeekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((day) => {
              const isoDate = toCalendarIso(day.date);
              const isCurrent = isoDate === currentDate;

              return (
                <Pressable
                  key={isoDate}
                  onPress={() => onSelectDate(isoDate)}
                  style={[
                    styles.calendarDayButton,
                    !day.inMonth && styles.calendarDayButtonMuted,
                    isCurrent && styles.calendarDayButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      !day.inMonth && styles.calendarDayTextMuted,
                      isCurrent && styles.calendarDayTextSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={styles.calendarCloseButton}>
            <Text style={styles.calendarCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function buildCalendarDays(cursor: Date) {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstGridDay = new Date(monthStart);
  firstGridDay.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function toCalendarIso(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 12,
  },
  topBar: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 70,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D8BE99",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonSolo: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D8BE99",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  backButtonText: {
    color: "#7B4B2A",
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#9B6331",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFF8EF",
    fontSize: 17,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  content: {
    paddingBottom: 28,
    gap: 12,
  },
  screenKicker: {
    color: "#7B5A2F",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  screenTitle: {
    color: "#1C1914",
    fontSize: 28,
    fontWeight: "800",
  },
  messageBanner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageError: {
    backgroundColor: "#F3DED8",
  },
  messageSuccess: {
    backgroundColor: "#E4EAD8",
  },
  messageText: {
    color: "#5C3623",
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 12,
  },
  gridTwo: {
    flexDirection: "row",
    gap: 10,
  },
  gridThree: {
    flexDirection: "row",
    gap: 8,
  },
  labeledField: {
    flex: 1,
    gap: 5,
  },
  inlineLabel: {
    color: "#6D8067",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#D8BE99",
    backgroundColor: "#FFFCF6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1E231C",
    fontSize: 16,
  },
  dateButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: "#D8BE99",
    backgroundColor: "#FFFCF6",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dateButtonText: {
    color: "#1E231C",
    fontSize: 16,
    fontWeight: "600",
  },
  inputMultiline: {
    minHeight: 74,
  },
  feedTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  feedTypeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedTypeToggleCompact: {
    gap: 5,
  },
  feedTypeBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#D1AF8B",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  feedTypeBoxChecked: {
    backgroundColor: "#F6E2D7",
  },
  feedTypeX: {
    color: "#7C5A34",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 12,
  },
  feedTypeLabel: {
    color: "#61745E",
    fontSize: 14,
    fontWeight: "700",
  },
  feedTypeLabelCompact: {
    fontSize: 13,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryLeft: {
    flex: 1,
    gap: 2,
  },
  summaryRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  summaryLabel: {
    color: "#697C62",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryLabelRight: {
    color: "#697C62",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  ticketNumber: {
    color: "#211D16",
    fontSize: 28,
    fontWeight: "900",
    fontFamily: serifFont,
  },
  summaryDate: {
    color: "#2A231C",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryNote: {
    color: "#C7B9A9",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryWeight: {
    color: "#514DE1",
    fontSize: 28,
    fontWeight: "900",
    fontFamily: serifFont,
  },
  summaryType: {
    color: "#4A5AA8",
    fontSize: 16,
    fontWeight: "800",
  },
  summaryMill: {
    color: "#2B241D",
    fontSize: 16,
    fontWeight: "700",
  },
  rollupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rollupText: {
    color: "#7A8069",
    fontSize: 16,
    fontWeight: "700",
  },
  rollupAccent: {
    color: "#514DE1",
    fontSize: 18,
    fontWeight: "900",
  },
  dropTable: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4D7C7",
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropTableHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropTableHeaderSpacer: {
    width: 24,
  },
  dropTableHeaderText: {
    color: "#7D806B",
    fontSize: 13,
    fontWeight: "700",
  },
  dropTableRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropTableValue: {
    color: "#2B241D",
    fontSize: 16,
    fontWeight: "700",
  },
  dropColBin: {
    width: 38,
  },
  dropColFlock: {
    flex: 1,
  },
  dropColType: {
    width: 42,
    textAlign: "center",
  },
  dropColAmt: {
    width: 64,
    textAlign: "right",
  },
  dropRemoveChip: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dropRemoveText: {
    color: "#A01828",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyDropText: {
    color: "#8A7D6B",
    fontSize: 14,
    fontWeight: "600",
  },
  addDropPill: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "#9B6331",
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  addDropPillText: {
    color: "#FFF8EF",
    fontSize: 16,
    fontWeight: "800",
  },
  binDropsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  binDropsTitle: {
    color: "#6C8165",
    fontSize: 24,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  binDropsCount: {
    color: "#12100D",
    fontSize: 30,
    fontWeight: "900",
    fontFamily: serifFont,
  },
  innerPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0D0BC",
    backgroundColor: "#FFFCF7",
    padding: 12,
    gap: 12,
  },
  stepSelectButton: {
    flex: 1,
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D4B58E",
    backgroundColor: "#FFFDF8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  stepSelectLabel: {
    color: "#76806A",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stepSelectValue: {
    color: "#4E50DE",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  stepSelectDanger: {
    color: "#A01828",
    fontSize: 18,
  },
  dropBodyRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  dropTypeColumn: {
    gap: 8,
    minWidth: 110,
  },
  dropAmountColumn: {
    flex: 1,
    alignItems: "center",
  },
  amountInput: {
    width: "100%",
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#CDB18C",
    backgroundColor: "#FFFDF8",
    textAlign: "center",
    color: "#514DE1",
    fontSize: 28,
    fontWeight: "900",
    fontFamily: serifFont,
  },
  amountLabel: {
    color: "#6F7E67",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  pendingPlacement: {
    color: "#6B5945",
    fontSize: 13,
    fontWeight: "700",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#5E6559",
    fontSize: 15,
    fontWeight: "600",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(19, 15, 11, 0.34)",
    justifyContent: "flex-end",
  },
  modalScrimCenter: {
    flex: 1,
    backgroundColor: "rgba(19, 15, 11, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    maxHeight: "78%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFF8EF",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 14,
  },
  modalTitle: {
    color: "#1E1A14",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  modalList: {
    gap: 10,
    paddingBottom: 8,
  },
  modalOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1D5C2",
    backgroundColor: "#FCF7EF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  modalOptionTitle: {
    color: "#7B4B2A",
    fontSize: 16,
    fontWeight: "800",
  },
  modalOptionCopy: {
    color: "#4E5550",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOptionMeta: {
    color: "#8D1F2B",
    fontSize: 13,
    fontWeight: "700",
  },
  modalCloseButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
  calendarCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3E8D8",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarArrowText: {
    color: "#7A4A21",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 28,
  },
  calendarMonthLabel: {
    color: "#1F2A1F",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  calendarWeekHeader: {
    flexDirection: "row",
  },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    color: "#7A715F",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  calendarDayButton: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  calendarDayButtonMuted: {
    opacity: 0.35,
  },
  calendarDayButtonSelected: {
    backgroundColor: "#8B572A",
  },
  calendarDayText: {
    color: "#2A251E",
    fontSize: 16,
    fontWeight: "700",
  },
  calendarDayTextMuted: {
    color: "#877D70",
  },
  calendarDayTextSelected: {
    color: "#FFF8EF",
  },
  calendarCloseButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCloseText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
  unsavedCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    padding: 18,
    gap: 14,
  },
  unsavedTitle: {
    color: "#1F2A1F",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  unsavedCopy: {
    color: "#5E584F",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  unsavedActions: {
    gap: 10,
  },
  unsavedPrimaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
  },
  unsavedPrimaryText: {
    color: "#FFF8EF",
    fontSize: 15,
    fontWeight: "800",
  },
  unsavedSecondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#F6EEDF",
    alignItems: "center",
    justifyContent: "center",
  },
  unsavedSecondaryText: {
    color: "#73491F",
    fontSize: 15,
    fontWeight: "800",
  },
  unsavedGhostButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  unsavedGhostText: {
    color: "#6B675F",
    fontSize: 15,
    fontWeight: "700",
  },
});
