I will implement a monthly PDF report generator and an enhanced budget alert system with visual feedback and customization.

### PDF Report Implementation
1.  **Create a dedicated PDF generation utility** using `jspdf` and `jspdf-autotable`. This utility will:
    *   Aggregate monthly data: income vs. expenses, top spending categories, and a summary of all transactions.
    *   Include the "SimplyFin" branding and current logo.
    *   Generate visual charts (simulated via tables/bars in PDF) for category distribution.
2.  **Add a "Download Monthly Report" button** to the `Index` dashboard header.
3.  **Implement the client-side logic** to fetch current month data and trigger the PDF generation.

### Enhanced Alerts & Budget Implementation
1.  **Modify the `budgets` table schema** via migration to include `alert_threshold` (percentage) and `notification_enabled` flags.
2.  **Update `SmartAlerts` component** to support interactive dismissal and more granular visual severity based on the new budget thresholds.
3.  **Update `smart-alerts` Edge Function** to:
    *   Detect spending anomalies using a simple statistical approach (z-score or percentage vs average).
    *   Check for category-specific budget overruns against the new thresholds.
    *   Include category-specific advice in the alert message.
4.  **Enhance the Budget Management UI** (likely in a dedicated settings or budget page) to allow users to set these thresholds.

### Technical Details
*   **Libraries:** `jspdf`, `jspdf-autotable`, `lucide-react`, `sonner` (for notifications).
*   **Data Flow:** Dashboard -> Supabase Query -> PDF Utility -> Browser Download.
*   **Anomaly Logic:** Compare current month category spending against the average of the last 3 months. If > 1.5x average, flag as anomalous.
*   **UI/UX:** Use `framer-motion` for smooth entry of alerts in the dashboard.
