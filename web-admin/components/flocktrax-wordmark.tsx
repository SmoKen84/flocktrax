type FlockTraxWordmarkProps = {
  product: "Admin" | "Mobile";
  descriptor?: string;
  tone?: "default" | "light" | "accent";
  compact?: boolean;
};

export function FlockTraxWordmark({
  product,
  descriptor,
  tone = "default",
  compact = false,
}: FlockTraxWordmarkProps) {
  return (
    <div className="flocktrax-wordmark" data-compact={compact} data-tone={tone}>
      <p className="flocktrax-wordmark-line">
        <span className="flocktrax-wordmark-brand">FlockTrax</span>
        <span className="flocktrax-wordmark-divider" aria-hidden="true">
          -
        </span>
        <span className="flocktrax-wordmark-product">
          {product}
          <sup className="flocktrax-wordmark-tm">TM</sup>
        </span>
      </p>
      {descriptor ? <p className="flocktrax-wordmark-descriptor">{descriptor}</p> : null}
    </div>
  );
}
