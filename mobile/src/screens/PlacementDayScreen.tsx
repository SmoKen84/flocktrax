import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { DashboardSettings, PlacementDayItem, PlacementSummary } from "../types";
import { formatDateByPattern, formatShortDate } from "../utils/date-format";

type Props = {
  canSaveDailyLogs: boolean;
  canSaveGradeBirds: boolean;
  canSaveMortality: boolean;
  item: PlacementDayItem | null;
  loading: boolean;
  logDate: string;
  placement: PlacementSummary;
  settings: DashboardSettings | null;
  onBack: () => void;
  onChangeDate: (nextDate: string) => void;
  onLoadDate: (nextDate: string) => void;
  onOpenWeightEntry: () => void;
  onSave: (item: PlacementDayItem) => Promise<PlacementDayItem | void>;
};

type PlacementTab = "daily" | "mortality" | "grade";

type FutureFields = {
};

const serifFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });

const defaultFutureFields: FutureFields = {};

export function PlacementDayScreen({
  canSaveDailyLogs,
  canSaveGradeBirds,
  canSaveMortality,
  item,
  loading,
  logDate,
  placement,
  settings,
  onBack,
  onChangeDate,
  onLoadDate,
  onOpenWeightEntry,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<PlacementDayItem | null>(item);
  const [futureFields, setFutureFields] = useState<FutureFields>(defaultFutureFields);
  const [saving, setSaving] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlacementTab>("daily");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => getMonthStart(logDate));
  const [taskChecks, setTaskChecks] = useState<boolean[]>([false, false, false, false]);
  const [leaveTarget, setLeaveTarget] = useState<"back" | "weights" | null>(null);

  useEffect(() => {
    setDraft(item);
    setLocalMessage(null);
    setHasUnsavedChanges(false);
    setTaskChecks([false, false, false, false]);
  }, [item]);

  useEffect(() => {
    setCalendarCursor(getMonthStart(logDate));
  }, [logDate]);

  const displayLogDate = formatDateByPattern(logDate, settings?.dow_date, logDate);
  const dailyTaskSlots = buildDailyTaskSlots(draft?.daily_tasks);

  async function save() {
    if (!draft) return;

    const permissionError = getPlacementSavePermissionError(activeTab, {
      canSaveDailyLogs,
      canSaveGradeBirds,
      canSaveMortality,
    });
    if (permissionError) {
      setLocalMessage(permissionError);
      return;
    }

    const validationError = validateDraft(draft, logDate);
    if (validationError) {
      setLocalMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setLocalMessage(null);
      await onSave(draft);
      if (shouldAutoAdvanceHistoricalDate(logDate, settings)) {
        const nextDate = addDaysToIsoDate(logDate, 1);
        setLocalMessage(
          `Saved. Loading ${formatShortDate(nextDate, settings?.short_date, nextDate)}...`,
        );
        onChangeDate(nextDate);
        onLoadDate(nextDate);
      } else {
        setLocalMessage("Saved to hosted FlockTrax.");
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndReport() {
    if (!draft) return false;

    const permissionError = getPlacementSavePermissionError(activeTab, {
      canSaveDailyLogs,
      canSaveGradeBirds,
      canSaveMortality,
    });
    if (permissionError) {
      setLocalMessage(permissionError);
      return false;
    }

    const validationError = validateDraft(draft, logDate);
    if (validationError) {
      setLocalMessage(validationError);
      return false;
    }

    try {
      setSaving(true);
      setLocalMessage(null);
      await onSave(draft);
      setLocalMessage("Saved to hosted FlockTrax.");
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleBackPress() {
    if (hasUnsavedChanges) {
      setLeaveTarget("back");
      return;
    }
    onBack();
  }

  function handleWeightsPress() {
    if (hasUnsavedChanges) {
      setLeaveTarget("weights");
      return;
    }
    onOpenWeightEntry();
  }

  async function handleLeaveSave() {
    const target = leaveTarget;
    const saved = await saveAndReport();
    if (!saved || !target) return;
    setLeaveTarget(null);
    if (target === "back") {
      onBack();
      return;
    }
    onOpenWeightEntry();
  }

  function handleLeaveDisregard() {
    const target = leaveTarget;
    setLeaveTarget(null);
    setHasUnsavedChanges(false);
    if (target === "back") {
      onBack();
      return;
    }
    if (target === "weights") {
      onOpenWeightEntry();
    }
  }

  const leavePermissionError = getPlacementSavePermissionError(activeTab, {
    canSaveDailyLogs,
    canSaveGradeBirds,
    canSaveMortality,
  });

  if (loading && !draft) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7B4B2A" />
        <Text style={styles.loadingText}>Loading placement day...</Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>No placement day data loaded.</Text>
        <Pressable onPress={onBack} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", default: undefined })}
      style={styles.screen}
    >
      <View style={styles.topBar}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable onPress={handleWeightsPress} style={styles.secondaryTopButton}>
          <Text style={styles.secondaryTopButtonText}>Weights</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={save}
          style={[styles.saveButton, saving && styles.buttonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF8EF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Log</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeaderCopy}>
              <Text style={styles.summaryBarn}>{placement.barn_code}</Text>
              <Text style={styles.summaryFarm}>{placement.farm_name}</Text>
            </View>
            <View style={styles.updateBadge}>
              <Text style={styles.updateBadgeText}>
                {draft.is_existing_log ? "Update Log" : "New Log"}
              </Text>
            </View>
          </View>

          <View style={styles.summaryMetricsRow}>
            <SummaryMetric
              label=""
              value={placement.placement_code}
              accent
              containerStyle={styles.summaryMetricCode}
              valueStyle={styles.summaryMetricValueCode}
              singleLine
            />
            <SummaryMetric
              label="Placed"
              containerStyle={styles.summaryMetricPlaced}
              value={formatPlacedSummaryDate(draft.placed_date)}
            />
            <SummaryMetric
              label="Age"
              containerStyle={styles.summaryMetricAge}
              value={`${draft.age_days ?? "--"}`}
              valueStyle={styles.summaryMetricValueAge}
            />
          </View>

          <Text style={styles.entryLabel}>Entry Date:</Text>
          <View style={styles.entryDateRow}>
            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={styles.entryDateInputButton}
            >
              <Text style={styles.entryDateInputText}>{displayLogDate}</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              style={styles.changeDateButton}
            >
              <Text style={styles.changeDateButtonText}>Pick{"\n"}Date</Text>
            </Pressable>
          </View>

          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>In the life of a chick...</Text>
            {dailyTaskSlots.map((task, index) => (
              <ChecklistRow
                key={task.id ?? `daily-task-${index}`}
                checked={taskChecks[index]}
                disabled={!task.label}
                label={task.label}
                onToggle={() =>
                  setTaskChecks((current) =>
                    current.map((checked, currentIndex) =>
                      currentIndex === index ? !checked : checked,
                    ),
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            active={activeTab === "daily"}
            label="Daily Log"
            onPress={() => setActiveTab("daily")}
          />
          <TabButton
            active={activeTab === "mortality"}
            label="Mortality"
            onPress={() => setActiveTab("mortality")}
          />
          <TabButton
            active={activeTab === "grade"}
            label="Grade"
            onPress={() => setActiveTab("grade")}
          />
        </View>

        {activeTab === "daily" ? (
          <DailyTab
            draft={draft}
            futureFields={futureFields}
            onChangeDraft={(patch) => {
              setDraft({ ...draft, ...patch });
              setHasUnsavedChanges(true);
            }}
            onChangeFuture={(patch) => {
              setFutureFields({ ...futureFields, ...patch });
              setHasUnsavedChanges(true);
            }}
          />
        ) : null}

        {activeTab === "mortality" ? (
          <MortalityTab
            draft={draft}
            logDate={logDate}
            shortDateSetting={settings?.short_date}
            onChangeDraft={(patch) => {
              setDraft({ ...draft, ...patch });
              setHasUnsavedChanges(true);
            }}
          />
        ) : null}

        {activeTab === "grade" ? (
          <GradeTab
            draft={draft}
            onChangeDraft={(patch) => {
              setDraft({ ...draft, ...patch });
              setHasUnsavedChanges(true);
            }}
          />
        ) : null}

        {localMessage ? <Text style={styles.message}>{localMessage}</Text> : null}
        {hasUnsavedChanges ? (
          <Text style={styles.pendingText}>Unsaved changes pending.</Text>
        ) : null}
      </ScrollView>

      <CalendarModal
        currentDate={logDate}
        cursor={calendarCursor}
        visible={isCalendarOpen}
        onChangeCursor={setCalendarCursor}
        onClose={() => setIsCalendarOpen(false)}
        onSelectDate={(nextDate) => {
          onChangeDate(nextDate);
          onLoadDate(nextDate);
          setIsCalendarOpen(false);
        }}
      />

      <UnsavedChangesModal
        visible={leaveTarget !== null}
        canSave={leavePermissionError === null}
        onCancel={() => setLeaveTarget(null)}
        onDisregard={handleLeaveDisregard}
        onSave={handleLeaveSave}
      />
    </KeyboardAvoidingView>
  );
}

function getPlacementSavePermissionError(
  activeTab: PlacementTab,
  permissions: {
    canSaveDailyLogs: boolean;
    canSaveGradeBirds: boolean;
    canSaveMortality: boolean;
  },
) {
  if (activeTab === "daily" && !permissions.canSaveDailyLogs) {
    return "Your permissions do not allow saving daily log entries.";
  }

  if (activeTab === "mortality" && !permissions.canSaveMortality) {
    return "Your permissions do not allow saving mortality entries.";
  }

  if (activeTab === "grade" && !permissions.canSaveGradeBirds) {
    return "Your permissions do not allow saving grading entries.";
  }

  return null;
}

type DailyTabProps = {
  draft: PlacementDayItem;
  futureFields: FutureFields;
  onChangeDraft: (patch: Partial<PlacementDayItem>) => void;
  onChangeFuture: (patch: Partial<FutureFields>) => void;
};

function DailyTab({
  draft,
  futureFields,
  onChangeDraft,
  onChangeFuture,
}: DailyTabProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitleSerif}>Environmental Conditions</Text>

      <Text style={styles.sectionLabel}>Barn Climate</Text>
      <View style={styles.gridThree}>
        <InlineField
          label="Temp"
          value={draft.am_temp}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ am_temp: toNullableNumber(value) })}
        />
        <InlineField
          label="Set Point"
          value={draft.set_temp}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ set_temp: toNullableNumber(value) })}
        />
        <InlineField
          label="Rel Humidity"
          value={draft.rel_humidity}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ rel_humidity: toNullableNumber(value) })}
        />
      </View>

      <Text style={styles.sectionLabel}>Outside Temp</Text>
      <View style={styles.gridThree}>
        <InlineField
          label="Current"
          value={draft.outside_temp_current}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ outside_temp_current: toNullableNumber(value) })}
        />
        <InlineField
          label="Low"
          value={draft.outside_temp_low}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ outside_temp_low: toNullableNumber(value) })}
        />
        <InlineField
          label="High"
          value={draft.outside_temp_high}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ outside_temp_high: toNullableNumber(value) })}
        />
      </View>

      <Text style={styles.sectionLabel}>Barn Settings</Text>
      <View style={styles.gridTwo}>
        <LabeledField
          label="Vent Settings"
          value={draft.min_vent}
          onChange={(value) => onChangeDraft({ min_vent: value || null })}
        />
        <LabeledField
          label="Ammonia Testing"
          value={draft.naoh}
          onChange={(value) => onChangeDraft({ naoh: value || null })}
        />
      </View>

      <View style={styles.gridTwo}>
        <InlineField
          label="Water Meter"
          value={draft.water_meter_reading}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ water_meter_reading: toNullableNumber(value) })}
        />
        <View style={styles.inlineField} />
      </View>

      <View style={styles.switchCard}>
        <Text style={styles.switchPrompt}>Pasture Access Doors Opened Today?</Text>
        <Switch
          onValueChange={(value) => onChangeDraft({ is_oda_open: value })}
          trackColor={{ false: "#C9CCC8", true: "#96B07C" }}
          value={draft.is_oda_open}
        />
      </View>

      <LabeledField
        label="ODA Exception"
        value={draft.oda_exception}
        onChange={(value) => onChangeDraft({ oda_exception: value || null })}
      />

      <LabeledField
        label="Comments"
        multiline
        value={draft.comment}
        onChange={(value) => onChangeDraft({ comment: value || null })}
      />

      <View style={styles.toggleGrid}>
        <ChecklistRow
          checked={draft.maintenance_flag}
          label="Maintenance"
          onToggle={() =>
            onChangeDraft({ maintenance_flag: !draft.maintenance_flag })
          }
        />
        <ChecklistRow
          checked={draft.feedlines_flag}
          label="Feedlines"
          onToggle={() =>
            onChangeDraft({ feedlines_flag: !draft.feedlines_flag })
          }
        />
        <ChecklistRow
          checked={draft.nipple_lines_flag}
          label="Nipple Lines"
          onToggle={() =>
            onChangeDraft({ nipple_lines_flag: !draft.nipple_lines_flag })
          }
        />
        <ChecklistRow
          checked={draft.bird_health_alert}
          label="Bird Health Alert!"
          onToggle={() =>
            onChangeDraft({ bird_health_alert: !draft.bird_health_alert })
          }
        />
      </View>

      <Text style={styles.footnoteText}>
        Describe repairs or bird health concerns in the comments section.
      </Text>
    </View>
  );
}

type MortalityTabProps = {
  draft: PlacementDayItem;
  logDate: string;
  shortDateSetting: string | null | undefined;
  onChangeDraft: (patch: Partial<PlacementDayItem>) => void;
};

function MortalityTab({
  draft,
  logDate,
  shortDateSetting,
  onChangeDraft,
}: MortalityTabProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitleSerif}>Mortality</Text>
        <Text style={styles.panelAccent}>
          {formatShortDate(logDate, shortDateSetting, logDate)}
        </Text>
      </View>

      <View style={styles.mortalitySummaryCard}>
        <View style={styles.mortalitySummaryRow}>
          <Text style={styles.mortalitySummaryLabel}>Dead Today</Text>
          <Text style={styles.mortalitySummaryValue}>
            {(draft.dead_male ?? 0) + (draft.dead_female ?? 0)}
          </Text>
        </View>
        <View style={styles.mortalitySummaryDivider} />
        <View style={styles.mortalitySummaryRow}>
          <Text style={styles.mortalitySummaryLabel}>Culls Today</Text>
          <Text style={styles.mortalitySummaryValue}>
            {(draft.cull_male ?? 0) + (draft.cull_female ?? 0)}
          </Text>
        </View>
      </View>

      <MortalityRow
        label="Males"
        deadValue={draft.dead_male}
        cullValue={draft.cull_male}
        noteValue={draft.cull_male_note}
        onDeadChange={(value) => onChangeDraft({ dead_male: toNullableNumber(value, 0) ?? 0 })}
        onCullChange={(value) => onChangeDraft({ cull_male: toNullableNumber(value, 0) ?? 0 })}
        onNoteChange={(value) => onChangeDraft({ cull_male_note: value || null })}
      />

      <MortalityRow
        label="Females"
        deadValue={draft.dead_female}
        cullValue={draft.cull_female}
        noteValue={draft.cull_female_note}
        onDeadChange={(value) => onChangeDraft({ dead_female: toNullableNumber(value, 0) ?? 0 })}
        onCullChange={(value) => onChangeDraft({ cull_female: toNullableNumber(value, 0) ?? 0 })}
        onNoteChange={(value) => onChangeDraft({ cull_female_note: value || null })}
      />

      <LabeledField
        label="Notes"
        multiline
        value={draft.dead_reason}
        onChange={(value) => onChangeDraft({ dead_reason: value || null })}
      />

      <View style={styles.metaFooterRow}>
        <View style={styles.metaFooterBlock}>
          <Text style={styles.metaFooterLabel}>Created By:</Text>
          <Text style={styles.metaFooterValue}>Current mobile user</Text>
        </View>
        <View style={styles.metaFooterBlock}>
          <Text style={styles.metaFooterLabel}>Last Updated By:</Text>
          <Text style={styles.metaFooterValue}>
            {draft.is_existing_log ? "Current mobile user" : "Not saved yet"}
          </Text>
        </View>
      </View>
    </View>
  );
}

type GradeTabProps = {
  draft: PlacementDayItem;
  onChangeDraft: (patch: Partial<PlacementDayItem>) => void;
};

function GradeTab({ draft, onChangeDraft }: GradeTabProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitleSerif}>Grading</Text>
        <Text style={styles.panelAccent}>{draft.placement_code}</Text>
      </View>

      <View style={styles.gridThree}>
        <InlineField
          label="Litter"
          value={draft.grade_litter}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ grade_litter: toNullableNumber(value) })}
        />
        <InlineField
          label="Footpads"
          value={draft.grade_footpad}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ grade_footpad: toNullableNumber(value) })}
        />
        <InlineField
          label="Feathers"
          value={draft.grade_feathers}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ grade_feathers: toNullableNumber(value) })}
        />
      </View>

      <View style={styles.gridTwoCompact}>
        <InlineField
          label="Lamness"
          value={draft.grade_lame}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ grade_lame: toNullableNumber(value) })}
        />
        <InlineField
          label="Pecking"
          value={draft.grade_pecking}
          keyboardType="decimal-pad"
          onChange={(value) => onChangeDraft({ grade_pecking: toNullableNumber(value) })}
        />
      </View>
    </View>
  );
}

type SummaryMetricProps = {
  label: string;
  value: string;
  accent?: boolean;
  containerStyle?: object;
  valueStyle?: object;
  singleLine?: boolean;
};

function SummaryMetric({
  label,
  value,
  accent = false,
  containerStyle,
  valueStyle,
  singleLine = false,
}: SummaryMetricProps) {
  return (
    <View style={[styles.summaryMetric, accent && styles.summaryMetricAccent, containerStyle]}>
      {label ? <Text style={styles.summaryMetricLabel}>{label}</Text> : <View style={styles.summaryMetricLabelSpacer} />}
      <Text
        adjustsFontSizeToFit={singleLine}
        numberOfLines={singleLine ? 1 : undefined}
        style={[styles.summaryMetricValue, accent && styles.summaryMetricValueAccent, valueStyle]}
      >
        {value}
      </Text>
    </View>
  );
}

type TabButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function TabButton({ active, label, onPress }: TabButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

type InlineFieldProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
};

function InlineField({
  label,
  value,
  onChange,
  keyboardType = "default",
}: InlineFieldProps) {
  return (
    <View style={styles.inlineField}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholderTextColor="#9A988F"
        style={styles.inlineInput}
        value={value === null || value === undefined ? "" : String(value)}
      />
    </View>
  );
}

type LabeledFieldProps = {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
};

function LabeledField({
  label,
  value,
  onChange,
  multiline = false,
}: LabeledFieldProps) {
  return (
    <View style={styles.labeledField}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChange}
        placeholderTextColor="#9A988F"
        style={[styles.largeInput, multiline && styles.largeInputMultiline]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value === null || value === undefined ? "" : String(value)}
      />
    </View>
  );
}

type ChecklistRowProps = {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
};

function ChecklistRow({ checked, label, disabled = false, onToggle }: ChecklistRowProps) {
  return (
    <Pressable disabled={disabled} onPress={onToggle} style={styles.checklistRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked, disabled && styles.checkboxDisabled]}>
        {checked ? <Text style={styles.checkboxMark}>X</Text> : null}
      </View>
      <Text style={[styles.checklistText, !label && styles.checklistTextEmpty]}>{label || " "}</Text>
    </Pressable>
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
      <View style={styles.modalScrim}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => onChangeCursor(addMonths(cursor, -1))}
              style={styles.calendarArrowButton}
            >
              <Text style={styles.calendarArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{currentMonthLabel}</Text>
            <Pressable
              onPress={() => onChangeCursor(addMonths(cursor, 1))}
              style={styles.calendarArrowButton}
            >
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
              const isoDate = toIsoDate(day.date);
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

type UnsavedChangesModalProps = {
  visible: boolean;
  canSave: boolean;
  onCancel: () => void;
  onDisregard: () => void;
  onSave: () => void;
};

function UnsavedChangesModal({
  visible,
  canSave,
  onCancel,
  onDisregard,
  onSave,
}: UnsavedChangesModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={canSave ? onCancel : onDisregard}
    >
      <View style={styles.modalScrim}>
        <View style={styles.unsavedCard}>
          <Text style={styles.unsavedTitle}>Unsaved Entries</Text>
          <Text style={styles.unsavedCopy}>
            {canSave
              ? "There are unsaved entries on this screen. Save them, disregard them, or cancel and stay here."
              : "There are unsaved entries on this screen, but this account cannot save them. Disregard them to leave this screen."}
          </Text>
          <View style={styles.unsavedActions}>
            {canSave ? (
              <Pressable onPress={onSave} style={styles.unsavedPrimaryButton}>
                <Text style={styles.unsavedPrimaryText}>Save</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onDisregard} style={styles.unsavedSecondaryButton}>
              <Text style={styles.unsavedSecondaryText}>Disregard</Text>
            </Pressable>
            {canSave ? (
              <Pressable onPress={onCancel} style={styles.unsavedGhostButton}>
                <Text style={styles.unsavedGhostText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

type MortalityRowProps = {
  label: string;
  deadValue: number;
  cullValue: number;
  noteValue: string | null;
  onDeadChange: (value: string) => void;
  onCullChange: (value: string) => void;
  onNoteChange: (value: string) => void;
};

function MortalityRow({
  label,
  deadValue,
  cullValue,
  noteValue,
  onDeadChange,
  onCullChange,
  onNoteChange,
}: MortalityRowProps) {
  return (
    <View style={styles.mortalityCard}>
      <View style={styles.mortalityCardHeader}>
        <Text style={styles.mortalityRowLabel}>{label}</Text>
      </View>

      <View style={styles.mortalityHeaderRow}>
        <Text style={styles.columnLabelCard}>Dead</Text>
        <Text style={styles.columnLabelCard}>Culls</Text>
        <Text style={styles.columnLabelWide}>Cull Reasons</Text>
      </View>

      <View style={styles.mortalityRow}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={onDeadChange}
          style={styles.mortalityCountInput}
          value={String(deadValue ?? 0)}
        />
        <TextInput
          keyboardType="number-pad"
          onChangeText={onCullChange}
          style={styles.mortalityCountInput}
          value={String(cullValue ?? 0)}
        />
        <TextInput
          onChangeText={onNoteChange}
          placeholder="Reason / note"
          placeholderTextColor="#9A988F"
          style={styles.mortalityReasonInput}
          value={noteValue ?? ""}
        />
      </View>
    </View>
  );
}

function toNullableNumber(value: string, fallback?: number) {
  if (!value.trim()) return fallback ?? null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback ?? null;
}

function shouldAutoAdvanceHistoricalDate(
  logDate: string,
  settings: DashboardSettings | null,
) {
  if (settings?.allow_historical_entry !== true) {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return false;
  }

  return logDate < todayIsoDate();
}

function validateDraft(draft: PlacementDayItem, logDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return "Log date must use MM/DD/YY.";
  }

  const counts = [draft.dead_female, draft.dead_male, draft.cull_female, draft.cull_male];
  if (counts.some((value) => value < 0)) {
    return "Mortality and cull counts cannot be negative.";
  }

  return null;
}

function formatPlacedSummaryDate(value: string | null | undefined) {
  if (!value) return "--";

  const dow = formatDateByPattern(value, "ddd", value);
  const shortDate = formatShortDate(value, "mm/dd/yy", value);
  return `${dow}\n${shortDate}`;
}

function buildDailyTaskSlots(tasks: PlacementDayItem["daily_tasks"] | undefined) {
  const filled = (tasks ?? [])
    .filter((task) => task.task_label.trim().length > 0)
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      label: task.task_label,
    }));

  while (filled.length < 4) {
    filled.push({
      id: `empty-${filled.length}`,
      label: "",
    });
  }

  return filled;
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date();
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getMonthStart(value: string) {
  const date = parseIsoDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function todayIsoDate() {
  return toIsoDate(new Date());
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
      inMonth: date.getMonth() === cursor.getMonth(),
    };
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 14,
  },
  backButton: {
    width: 68,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B572A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  backButtonText: {
    color: "#73491F",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryTopButton: {
    minWidth: 92,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryTopButtonText: {
    color: "#73491F",
    fontSize: 15,
    fontWeight: "800",
  },
  saveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#8B572A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B572A",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  saveButtonText: {
    color: "#FFF8EF",
    fontSize: 18,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  content: {
    paddingBottom: 28,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 14,
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryHeaderCopy: {
    flex: 1,
  },
  summaryBarn: {
    color: "#A01828",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 32,
    fontFamily: serifFont,
  },
  summaryFarm: {
    color: "#2A251E",
    fontSize: 17,
    fontWeight: "700",
  },
  updateBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#EBD9BC",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  updateBadgeText: {
    color: "#9C3D2A",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryMetricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryMetric: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#F6EEDF",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 3,
    alignItems: "center",
  },
  summaryMetricCode: {
    flex: 1.05,
  },
  summaryMetricPlaced: {
    flex: 1.2,
  },
  summaryMetricAge: {
    flex: 0.75,
  },
  summaryMetricAccent: {
    alignItems: "flex-start",
  },
  summaryMetricLabel: {
    color: "#7A715F",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryMetricLabelSpacer: {
    minHeight: 13,
  },
  summaryMetricValue: {
    color: "#8B2D2D",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: serifFont,
  },
  summaryMetricValueAccent: {
    fontSize: 16,
  },
  summaryMetricValueCode: {
    fontSize: 24,
    lineHeight: 28,
  },
  summaryMetricValueAge: {
    fontSize: 28,
    lineHeight: 30,
  },
  entryLabel: {
    color: "#7B6749",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  entryDateRow: {
    flexDirection: "row",
    gap: 10,
  },
  entryDateInputButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 13,
    justifyContent: "center",
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  entryDateInputText: {
    color: "#8D1F2B",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  changeDateButton: {
    width: 112,
    borderRadius: 16,
    backgroundColor: "#EBD9BC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  changeDateButtonText: {
    color: "#A1662F",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    lineHeight: 14,
  },
  reminderCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1D5C2",
    backgroundColor: "#FFF9F1",
    padding: 14,
    gap: 10,
  },
  reminderTitle: {
    color: "#667057",
    fontSize: 15,
    fontWeight: "700",
    fontStyle: "italic",
    fontFamily: serifFont,
  },
  reminderMeta: {
    fontSize: 10,
    fontStyle: "normal",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabButtonActive: {
    backgroundColor: "#8B572A",
    borderColor: "#8B572A",
  },
  tabButtonText: {
    color: "#7A4A21",
    fontSize: 14,
    fontWeight: "800",
  },
  tabButtonTextActive: {
    color: "#FFF8EF",
  },
  panel: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 14,
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: "#9A6D39",
    fontSize: 22,
    fontWeight: "800",
  },
  panelTitleSerif: {
    color: "#9A6D39",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  panelAccent: {
    color: "#A01828",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  sectionLabel: {
    color: "#5F7158",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: -4,
  },
  gridThree: {
    flexDirection: "row",
    gap: 10,
  },
  gridTwo: {
    flexDirection: "row",
    gap: 10,
  },
  gridTwoCompact: {
    flexDirection: "row",
    gap: 14,
    paddingRight: 96,
  },
  inlineField: {
    flex: 1,
    gap: 6,
  },
  inlineLabel: {
    color: "#5F7158",
    fontSize: 13,
    fontWeight: "700",
  },
  inlineInput: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#1F2A1F",
    fontSize: 16,
    fontWeight: "700",
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  labeledField: {
    flex: 1,
    gap: 6,
  },
  largeInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1F2A1F",
    fontSize: 16,
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  largeInputMultiline: {
    minHeight: 112,
  },
  switchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  switchPrompt: {
    color: "#5F7158",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  toggleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
    rowGap: 8,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: "45%",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#8F8B80",
    borderRadius: 2,
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#F4EBDD",
  },
  checkboxDisabled: {
    borderColor: "#D8D1C5",
    backgroundColor: "#F7F2EA",
  },
  checkboxMark: {
    color: "#3C3A34",
    fontSize: 12,
    fontWeight: "800",
  },
  checklistText: {
    color: "#4F514A",
    fontSize: 14,
    flex: 1,
  },
  checklistTextEmpty: {
    color: "#C9C0B0",
  },
  footnoteText: {
    color: "#8A8476",
    fontSize: 12,
    lineHeight: 16,
    marginTop: -4,
  },
  mortalityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mortalitySummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1D5C2",
    backgroundColor: "#FFF9F1",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mortalitySummaryRow: {
    flex: 1,
    gap: 4,
  },
  mortalitySummaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#E1D5C2",
    marginHorizontal: 14,
  },
  mortalitySummaryLabel: {
    color: "#7A715F",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mortalitySummaryValue: {
    color: "#8B2D2D",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  columnLabelCard: {
    width: 64,
    color: "#6B6D63",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  columnLabelWide: {
    flex: 1,
    color: "#6B6D63",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  mortalityCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E1D5C2",
    backgroundColor: "#FFF9F1",
    padding: 14,
    gap: 12,
  },
  mortalityCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mortalityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mortalityRowLabel: {
    color: "#667057",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  mortalityCountInput: {
    width: 64,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    color: "#1F2A1F",
    fontSize: 16,
    fontWeight: "700",
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mortalityReasonInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#C79A67",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    color: "#1F2A1F",
    fontSize: 15,
    shadowColor: "#7B4B2A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metaFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 2,
  },
  metaFooterBlock: {
    flex: 1,
  },
  metaFooterLabel: {
    color: "#7A715F",
    fontSize: 10,
    fontWeight: "700",
  },
  metaFooterValue: {
    color: "#5C77B7",
    fontSize: 11,
    lineHeight: 15,
  },
  message: {
    color: "#3F6530",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  pendingText: {
    color: "#8A2E0D",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
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
  ghostButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B9A17B",
    backgroundColor: "#FFF8EF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: {
    color: "#644123",
    fontWeight: "700",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(28, 24, 20, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
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
