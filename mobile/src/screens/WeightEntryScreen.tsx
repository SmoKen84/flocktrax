import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PlacementSummary, WeightBenchmark, WeightEntryItem, WeightSampleEntry } from "../types";

type Props = {
  canSave: boolean;
  item: WeightEntryItem | null;
  loading: boolean;
  logDate: string;
  placement: PlacementSummary;
  onBack: () => void;
  onSave: (item: WeightEntryItem) => Promise<void>;
};

const serifFont = Platform.select({ ios: "Georgia", android: "serif", default: undefined });

export function WeightEntryScreen({
  canSave,
  item,
  loading,
  logDate,
  placement,
  onBack,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<WeightEntryItem | null>(item);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(item);
    setMessage(null);
  }, [item]);

  async function save() {
    if (!draft) return;
    if (!canSave) {
      setMessage("Your permissions do not allow saving weight entries.");
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      await onSave(draft);
      setMessage("Weight summary saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Weight save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7B4B2A" />
        <Text style={styles.loadingText}>Loading weight entry...</Text>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>No weight entry loaded.</Text>
        <Pressable onPress={onBack} style={styles.backButtonSolo}>
          <Text style={styles.backButtonText}>Back</Text>
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
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Pressable disabled={saving} onPress={save} style={[styles.saveButton, saving && styles.buttonDisabled]}>
          {saving ? <ActivityIndicator color="#FFF8EF" /> : <Text style={styles.saveButtonText}>Save Weights</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeaderCopy}>
              <Text style={styles.summaryBarn}>{placement.barn_code}</Text>
              <Text style={styles.summaryFarm}>{placement.farm_name}</Text>
            </View>
          </View>

          <View style={styles.summaryMetricsRow}>
            <SummaryMetric
              label=""
              value={placement.placement_code}
              accent
              valueStyle={styles.summaryMetricValueCode}
              singleLine
            />
            <SummaryMetric label="Date" value={formatDate(logDate)} singleLine />
            <SummaryMetric
              label="Age"
              value={draft.placement_age_days === null || draft.placement_age_days === undefined ? "--" : String(draft.placement_age_days)}
              valueStyle={styles.summaryMetricValueAge}
            />
          </View>

          <Text style={styles.summaryHint}>
            Enter the summary returned by the scale for each sample.
          </Text>
        </View>

        <WeightSampleCard
          title="Male Sample"
          benchmark={draft.male_benchmark}
          sample={draft.male_sample}
          onChange={(nextSample) => setDraft({ ...draft, male_sample: nextSample })}
        />

        <WeightSampleCard
          title="Female Sample"
          benchmark={draft.female_benchmark}
          sample={draft.female_sample}
          onChange={(nextSample) => setDraft({ ...draft, female_sample: nextSample })}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type WeightSampleCardProps = {
  title: string;
  benchmark: WeightBenchmark | null;
  sample: WeightSampleEntry;
  onChange: (nextSample: WeightSampleEntry) => void;
};

function WeightSampleCard({ title, benchmark, sample, onChange }: WeightSampleCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {benchmark?.genetic_name ? (
          <Text numberOfLines={1} style={styles.cardBreedLine}>
            {benchmark.genetic_name}
          </Text>
        ) : null}
      </View>

      <View style={styles.gridTwo}>
        <InlineField
          label="Count"
          keyboardType="number-pad"
          value={sample.cnt_weighed}
          onChange={(value) => onChange({ ...sample, cnt_weighed: toNullableInteger(value) })}
        />
        <InlineField
          label="Average Wt"
          benchmarkLabel={formatBenchmarkValue(benchmark?.target_weight)}
          keyboardType="decimal-pad"
          value={sample.avg_weight}
          onChange={(value) => onChange({ ...sample, avg_weight: toNullableDecimal(value) })}
        />
      </View>

      <View style={styles.gridTwo}>
        <InlineField
          label="Std Dev"
          keyboardType="decimal-pad"
          value={sample.stddev_weight}
          onChange={(value) => onChange({ ...sample, stddev_weight: toNullableDecimal(value) })}
        />
        <InlineField
          label="Procure"
          benchmarkLabel={formatBenchmarkValue(benchmark?.day_feed_per_bird)}
          keyboardType="decimal-pad"
          value={sample.procure}
          onChange={(value) => onChange({ ...sample, procure: toNullableDecimal(value) })}
        />
      </View>

      {benchmark?.note ? <Text style={styles.benchmarkNote}>{benchmark.note}</Text> : null}

      <LabeledField
        label="Scale Notes"
        multiline
        value={sample.other_note}
        onChange={(value) => onChange({ ...sample, other_note: value || null })}
      />
    </View>
  );
}

type SummaryMetricProps = {
  label: string;
  value: string;
  accent?: boolean;
  valueStyle?: object;
  singleLine?: boolean;
};

function SummaryMetric({
  label,
  value,
  accent = false,
  valueStyle,
  singleLine = false,
}: SummaryMetricProps) {
  return (
    <View style={[styles.summaryMetric, accent && styles.summaryMetricAccent]}>
      {label ? <Text style={styles.summaryMetricLabel}>{label}</Text> : <View style={styles.summaryMetricLabelSpacer} />}
      <Text
        adjustsFontSizeToFit={singleLine}
        minimumFontScale={singleLine ? 0.82 : undefined}
        numberOfLines={singleLine ? 1 : undefined}
        style={[styles.summaryMetricValue, accent && styles.summaryMetricValueAccent, valueStyle]}
      >
        {value}
      </Text>
    </View>
  );
}

type InlineFieldProps = {
  label: string;
  benchmarkLabel?: string | null;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
};

function InlineField({
  label,
  benchmarkLabel = null,
  value,
  onChange,
  keyboardType = "default",
}: InlineFieldProps) {
  const [textValue, setTextValue] = useState(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setTextValue(value === null || value === undefined ? "" : String(value));
  }, [value]);

  return (
    <View style={styles.inlineField}>
      <View style={styles.inlineLabelRow}>
        <Text style={styles.inlineLabel}>{label}</Text>
        {benchmarkLabel ? <Text style={styles.inlineBenchmark}>{benchmarkLabel}</Text> : null}
      </View>
      <TextInput
        keyboardType={keyboardType}
        inputMode={keyboardType === "decimal-pad" ? "decimal" : keyboardType === "number-pad" ? "numeric" : "text"}
        onChangeText={(nextValue) => {
          setTextValue(nextValue);
          onChange(nextValue);
        }}
        placeholderTextColor="#9A988F"
        style={styles.inlineInput}
        value={textValue}
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

function LabeledField({ label, value, onChange, multiline = false }: LabeledFieldProps) {
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

function toNullableInteger(value: string) {
  if (!value.trim()) return null;
  const digitsOnly = value.replace(/[^\d-]/g, "");
  if (!digitsOnly.trim()) return null;
  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDecimal(value: string) {
  if (!value.trim()) return null;
  const normalized = value.replace(/,/g, ".").trim();
  if (!/^-?\d*(\.\d*)?$/.test(normalized)) {
    return null;
  }
  if (normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "2-digit",
    year: "numeric",
  });
}

function formatBenchmarkValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return `Std ${value}`;
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
  },
  backButtonSolo: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D2B892",
    backgroundColor: "#FFF8EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  backButtonText: {
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
    gap: 12,
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
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  summaryHeaderCopy: {
    flex: 1,
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
  summaryHint: {
    color: "#6A5643",
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    borderRadius: 22,
    backgroundColor: "#FFF8EF",
    borderWidth: 1,
    borderColor: "#DCC9AF",
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    color: "#9A6D39",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: serifFont,
  },
  cardBreedLine: {
    color: "#6E675C",
    fontSize: 13,
    fontWeight: "700",
  },
  gridTwo: {
    flexDirection: "row",
    gap: 10,
  },
  inlineField: {
    flex: 1,
    gap: 6,
  },
  inlineLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  inlineLabel: {
    color: "#5F7158",
    fontSize: 13,
    fontWeight: "700",
  },
  inlineBenchmark: {
    color: "#8B572A",
    fontSize: 12,
    fontWeight: "800",
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
    minHeight: 96,
  },
  benchmarkNote: {
    color: "#7A715F",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -2,
  },
  message: {
    color: "#3F6530",
    fontSize: 14,
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
});
