# ═══════════════════════════════════════════════════════════════════════════════
# run_validation.py
# Standalone validation script — no Jupyter needed.
#
# PREREQUISITES — run these two cells in combined training.ipynb ONCE:
#   1. All cells through Cell 16 (PHASE 5 Evaluation)
#   2. The newly-added "Save Predictions" cell (Cell 17)
#      → This creates y_test_Wm2.npy and pred_lstm_Wm2.npy in the Codes folder.
#
# Then just run this script:  python run_validation.py
# ═══════════════════════════════════════════════════════════════════════════════

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from scipy.stats import norm as scipy_norm
import os, sys

CODES_DIR  = r'D:\Semester Project and Notes\3rd Year Project\Codes'
SAVE_DIR   = r'D:\Semester Project and Notes\3rd Year Project\Graphs'
os.makedirs(SAVE_DIR, exist_ok=True)

# ── Load prediction arrays ────────────────────────────────────────────────────
y_path = os.path.join(CODES_DIR, 'y_test_Wm2.npy')
p_path = os.path.join(CODES_DIR, 'pred_lstm_Wm2.npy')

if not os.path.exists(y_path) or not os.path.exists(p_path):
    print("ERROR: Prediction arrays not found.")
    print("  Please run cells 1–17 in 'combined training.ipynb' first,")
    print("  then re-run this script.")
    sys.exit(1)

y_test_Wm2 = np.load(y_path)
pred_Wm2   = np.load(p_path)
print(f"Loaded arrays: y_test={y_test_Wm2.shape}, pred={pred_Wm2.shape}")

# ── Known comparison metrics from stored notebook outputs ─────────────────────
MODELS = {
    'LSTM':     {'r2': 0.9429, 'rmse': 61.63, 'train_sec': 15000},
    'GRU':      {'r2': 0.9327, 'rmse': 66.88, 'train_sec':  1856},
    'CNN-LSTM': {'r2': 0.9298, 'rmse': 68.33, 'train_sec':  1133},
}

print("\n" + "=" * 65)
print("  EXTENDED VALIDATION — Q1 JOURNAL METRICS")
print("=" * 65)

# ── 1. LSTM extended metrics ──────────────────────────────────────────────────
rmse_h = np.sqrt(mean_squared_error(y_test_Wm2, pred_Wm2))
mae_h  = mean_absolute_error(y_test_Wm2, pred_Wm2)
r2_h   = r2_score(y_test_Wm2, pred_Wm2)
mbe_h  = np.mean(pred_Wm2 - y_test_Wm2)

# nRMSE — normalised to mean of daytime (non-zero) GHI only
mean_ghi_day = np.mean(y_test_Wm2[y_test_Wm2 > 0])
nrmse_h      = (rmse_h / mean_ghi_day) * 100

# ── 2. Persistence baseline ───────────────────────────────────────────────────
rmse_persist  = np.sqrt(mean_squared_error(y_test_Wm2[1:], y_test_Wm2[:-1]))
mae_persist   = mean_absolute_error(y_test_Wm2[1:], y_test_Wm2[:-1])
r2_persist    = r2_score(y_test_Wm2[1:], y_test_Wm2[:-1])
nrmse_persist = (rmse_persist / mean_ghi_day) * 100

# ── 3. Skill Scores ───────────────────────────────────────────────────────────
ss_lstm = 1.0 - (rmse_h / rmse_persist)
# For GRU and CNN-LSTM use stored RMSE values
ss_gru  = 1.0 - (MODELS['GRU']['rmse']     / rmse_persist)
ss_cnn  = 1.0 - (MODELS['CNN-LSTM']['rmse'] / rmse_persist)

# ── 4. Print Table 2 ─────────────────────────────────────────────────────────
print(f"\n{'─'*76}")
print(f"  Table 2 — Hourly GHI Performance (All Architectures + Persistence)")
print(f"{'─'*76}")
print(f"  {'Model':<20} {'R²':>7} {'RMSE':>9} {'MAE':>9} {'MBE':>9} {'nRMSE%':>8} {'Skill':>7}")
print(f"  {'':20} {'':>7} {'W/m²':>9} {'W/m²':>9} {'W/m²':>9} {'':>8} {'Score':>7}")
print(f"  {'─'*76}")
print(f"  {'LSTM (selected)':<20} {r2_h:>7.4f} {rmse_h:>9.2f} {mae_h:>9.2f} {mbe_h:>+9.2f} {nrmse_h:>8.2f} {ss_lstm:>7.4f}")
print(f"  {'GRU':<20} {MODELS['GRU']['r2']:>7.4f} {MODELS['GRU']['rmse']:>9.2f} {'—':>9} {'—':>9} {1.0-MODELS['GRU']['r2']:>8.4f} {ss_gru:>7.4f}")
print(f"  {'CNN-LSTM':<20} {MODELS['CNN-LSTM']['r2']:>7.4f} {MODELS['CNN-LSTM']['rmse']:>9.2f} {'—':>9} {'—':>9} {1.0-MODELS['CNN-LSTM']['r2']:>8.4f} {ss_cnn:>7.4f}")
print(f"  {'Persistence (ref)':<20} {r2_persist:>7.4f} {rmse_persist:>9.2f} {mae_persist:>9.2f} {'—':>9} {nrmse_persist:>8.2f} {'0.0000':>7}")
print(f"{'─'*76}")
print(f"\n  ★  Persistence RMSE reference : {rmse_persist:.2f} W/m²")
print(f"  ★  LSTM Forecast Skill Score  : {ss_lstm:.4f}")
print(f"  ★  LSTM MAE                   : {mae_h:.2f} W/m²")
print(f"  ★  LSTM MBE                   : {mbe_h:+.2f} W/m²  {'(over-predicts)' if mbe_h > 0 else '(under-predicts)'}")
print(f"  ★  LSTM nRMSE                 : {nrmse_h:.2f}% (of mean daytime GHI = {mean_ghi_day:.1f} W/m²)")
print(f"\n  Daily LSTM  R²  = 0.9763  |  RMSE = 1.16 kWh/m²/day  (from Cell 17)")

# ── 5. Publication Figures ────────────────────────────────────────────────────
print("\nGenerating publication figures...")

fig = plt.figure(figsize=(17, 11))
fig.patch.set_facecolor('#F9F7F4')
gs  = gridspec.GridSpec(2, 2, figure=fig, hspace=0.44, wspace=0.30)

FT  = {'fontsize': 12, 'fontweight': 'bold', 'color': '#111111'}
FA  = {'fontsize': 10, 'color': '#555555'}
C   = {'actual': '#111111', 'lstm': '#C0392B', 'amber': '#E67E22'}

# Panel A — Time Series (168 h)
ax1 = fig.add_subplot(gs[0, :])
N   = min(168, len(y_test_Wm2))
ax1.plot(y_test_Wm2[:N], color=C['actual'], lw=1.6, label='Observed GHI', zorder=3)
ax1.plot(pred_Wm2[:N],   color=C['lstm'],   lw=1.2, ls='--', alpha=0.9,
         label=f'LSTM  (R²={r2_h:.4f}, RMSE={rmse_h:.2f} W/m²)', zorder=2)
ax1.fill_between(range(N), y_test_Wm2[:N], pred_Wm2[:N],
                 alpha=0.10, color=C['lstm'])
ax1.set_title('Fig. A — Validation: Observed vs. LSTM Predicted GHI (First 168 Hours)', **FT, pad=10)
ax1.set_xlabel('Hour Index (Test Set)', **FA)
ax1.set_ylabel('GHI  (W / m²)', **FA)
ax1.legend(fontsize=9.5, framealpha=0.75)
ax1.grid(True, alpha=0.2, ls=':')
ax1.set_facecolor('#FDFCFA')
atxt = (f"R²={r2_h:.4f}  RMSE={rmse_h:.2f} W/m²  MAE={mae_h:.2f} W/m²\n"
        f"MBE={mbe_h:+.2f} W/m²  nRMSE={nrmse_h:.2f}%  Skill Score={ss_lstm:.4f}")
ax1.text(0.99, 0.97, atxt, transform=ax1.transAxes, fontsize=8.5, va='top', ha='right',
         bbox=dict(boxstyle='round,pad=0.4', fc='white', ec='#CCCCCC', alpha=0.9))

# Panel B — Scatter
ax2 = fig.add_subplot(gs[1, 0])
step = max(1, len(y_test_Wm2) // 6000)
ax2.scatter(y_test_Wm2[::step], pred_Wm2[::step],
            s=2, alpha=0.18, color=C['lstm'], rasterized=True)
lmax = max(y_test_Wm2.max(), pred_Wm2.max()) * 1.04
ax2.plot([0, lmax], [0, lmax], color=C['actual'], lw=1.3, ls='--', label='1:1 line', zorder=5)
ax2.set_title('Fig. B — Scatter: Predicted vs. Observed', **FT, pad=8)
ax2.set_xlabel('Observed GHI  (W/m²)',  **FA)
ax2.set_ylabel('Predicted GHI  (W/m²)', **FA)
ax2.set_xlim(0, lmax); ax2.set_ylim(0, lmax)
ax2.text(0.05, 0.92, f'R² = {r2_h:.4f}', transform=ax2.transAxes,
         fontsize=10, fontweight='bold', color=C['lstm'])
ax2.legend(fontsize=8.5, framealpha=0.7)
ax2.grid(True, alpha=0.18, ls=':')
ax2.set_facecolor('#FDFCFA')

# Panel C — Residuals
ax3 = fig.add_subplot(gs[1, 1])
residuals = pred_Wm2 - y_test_Wm2
ax3.hist(residuals, bins=100, color=C['lstm'], alpha=0.70,
         edgecolor='white', linewidth=0.3, density=True, label='Residuals')
mu, sigma = residuals.mean(), residuals.std()
x_fit = np.linspace(residuals.min(), residuals.max(), 400)
ax3.plot(x_fit, scipy_norm.pdf(x_fit, mu, sigma),
         color=C['actual'], lw=1.8, label=f'N(μ={mu:.1f}, σ={sigma:.1f}) W/m²')
ax3.axvline(0,     color='black',      lw=1.2, ls='--', label='Zero error')
ax3.axvline(mbe_h, color=C['amber'],   lw=1.3, ls=':',
            label=f'MBE = {mbe_h:+.2f} W/m²')
ax3.set_title('Fig. C — Residual Distribution  (Predicted − Observed)', **FT, pad=8)
ax3.set_xlabel('Residual  (W/m²)',    **FA)
ax3.set_ylabel('Probability Density', **FA)
ax3.legend(fontsize=8.5, framealpha=0.7)
ax3.grid(True, alpha=0.18, ls=':')
ax3.set_facecolor('#FDFCFA')

fig.suptitle(
    'LSTM Validation Diagnostics — Koshi Province GHI Forecasting\n'
    'Kathmandu University · Department of Mechanical Engineering · 2026',
    fontsize=13, fontweight='bold', y=1.01)

caption = (
    f"2-layer LSTM trained on 630,720 hourly records (6 sites, Koshi Province, Nepal, 2013–2024, Solcast). "
    f"Test set (20% holdout): R²={r2_h:.4f}, RMSE={rmse_h:.2f} W/m², MAE={mae_h:.2f} W/m², "
    f"MBE={mbe_h:+.2f} W/m², nRMSE={nrmse_h:.2f}%, Forecast Skill Score={ss_lstm:.4f} "
    f"vs. persistence baseline (RMSE={rmse_persist:.2f} W/m²). "
    f"Daily aggregated: R²=0.9763, RMSE=1.16 kWh/m²/day."
)
fig.text(0.5, -0.015, caption, ha='center', va='top',
         fontsize=7.5, color='#888888', style='italic')

pdf_path = os.path.join(SAVE_DIR, 'validation_diagnostics.pdf')
png_path = os.path.join(SAVE_DIR, 'validation_diagnostics.png')
plt.savefig(pdf_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.savefig(png_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
print(f"\n  Saved → {pdf_path}")
print(f"  Saved → {png_path}")
plt.show()
print("\nDone.")
