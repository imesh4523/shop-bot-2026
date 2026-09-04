import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";
import { AdminNotifier } from "@/components/admin-notifier";

// Eagerly import all pages
import Dashboard from "@/pages/dashboard";
import ProductsPage from "@/pages/products-page";
import InventoryPage from "@/pages/inventory-page";
import OrdersPage from "@/pages/orders-page";
import PaymentsPage from "@/pages/payments-page";
import SettingsPage from "@/pages/settings-page";
import AwsCheckerPage from "@/pages/aws-checker-page";
import BroadcastPage from "@/pages/broadcast-page";
import LoginPage from "@/pages/login-page";
import SpecialOffersPage from "@/pages/special-offers-page";
import PromoCodesPage from "@/pages/promo-codes-page";
import TelegramUsersPage from "@/pages/telegram-users-page";
import ReferralsPage from "@/pages/referrals-page";
import SpamProtectorPage from "@/pages/spam-protector-page";
import TelegramInspectorPage from "@/pages/telegram-inspector-page";
import TelegramClientPage from "@/pages/telegram-client-page";
import BackupPage from "@/pages/backup-page";
import ForwardPage from "@/pages/forward-page";
import SupportTicketsPage from "@/pages/support-tickets-page";
import CustomerTrackerPage from "@/pages/customer-tracker-page";
import PreordersPage from "@/pages/preorders-page";
import MiniAppShop from "@/pages/mini-app-shop";
import ApiDocsPage from "@/pages/api-docs-page";
import AdminApiKeysPage from "@/pages/admin-api-keys-page";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/error-boundary";

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Redirect to="/imeshadmindashbord/login" />;
  }

  return (
    <LayoutShell>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </LayoutShell>
  );
}

function RootRouteHandler() {
  if (typeof window !== "undefined") {
    const lastPath = localStorage.getItem("pwa_last_path");
    if (lastPath && (lastPath.startsWith("/imeshadmindashbord") || lastPath.startsWith("/shop"))) {
      return <Redirect to={lastPath} />;
    }
  }

  // Default root path '/' loads the Storefront Web Shop (MiniAppShop)
  return <MiniAppShop />;
}

function Router() {
  return (
    <Switch>
      {/* Public Pages */}
      <Route path="/docs">
        <ApiDocsPage />
      </Route>

      <Route path="/shop">
        <MiniAppShop />
      </Route>

      {/* Secret Admin Route Login */}
      <Route path="/imeshadmindashbord/login">
        <LoginPage />
      </Route>
      <Route path="/login">
        <Redirect to="/imeshadmindashbord/login" />
      </Route>

      {/* Secret Admin Routes (/imeshadmindashbord/*) */}
      <Route path="/imeshadmindashbord">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path="/imeshadmindashbord/api-keys">
        <ProtectedRoute component={AdminApiKeysPage} />
      </Route>

      <Route path="/imeshadmindashbord/customer-tracker">
        <ProtectedRoute component={CustomerTrackerPage} />
      </Route>

      <Route path="/imeshadmindashbord/preorders">
        <ProtectedRoute component={PreordersPage} />
      </Route>
      
      <Route path="/imeshadmindashbord/products">
        <ProtectedRoute component={ProductsPage} />
      </Route>
      
      <Route path="/imeshadmindashbord/inventory">
        <ProtectedRoute component={InventoryPage} />
      </Route>

      <Route path="/imeshadmindashbord/orders">
        <ProtectedRoute component={OrdersPage} />
      </Route>

      <Route path="/imeshadmindashbord/payments">
        <ProtectedRoute component={PaymentsPage} />
      </Route>

      <Route path="/imeshadmindashbord/support-tickets">
        <ProtectedRoute component={SupportTicketsPage} />
      </Route>

      <Route path="/imeshadmindashbord/broadcast">
        <ProtectedRoute component={BroadcastPage} />
      </Route>

      <Route path="/imeshadmindashbord/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

      <Route path="/imeshadmindashbord/aws-checker">
        <ProtectedRoute component={AwsCheckerPage} />
      </Route>

      <Route path="/imeshadmindashbord/special-offers">
        <ProtectedRoute component={SpecialOffersPage} />
      </Route>

      <Route path="/imeshadmindashbord/promo-codes">
        <ProtectedRoute component={PromoCodesPage} />
      </Route>

      <Route path="/imeshadmindashbord/backups">
        <ProtectedRoute component={BackupPage} />
      </Route>

      <Route path="/imeshadmindashbord/users">
        <ProtectedRoute component={TelegramUsersPage} />
      </Route>

      <Route path="/imeshadmindashbord/referrals">
        <ProtectedRoute component={ReferralsPage} />
      </Route>

      <Route path="/imeshadmindashbord/spam-protector">
        <ProtectedRoute component={SpamProtectorPage} />
      </Route>

      <Route path="/imeshadmindashbord/telegram-inspector">
        <ProtectedRoute component={TelegramInspectorPage} />
      </Route>

      <Route path="/imeshadmindashbord/telegram-client">
        <ProtectedRoute component={TelegramClientPage} />
      </Route>

      <Route path="/imeshadmindashbord/forward">
        <ProtectedRoute component={ForwardPage} />
      </Route>

      {/* Root Path redirects to public API docs */}
      <Route path="/">
        <RootRouteHandler />
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

import { ThemeProvider } from "@/components/theme-provider";

function App() {
  useEffect(() => {
    const updateManifestAndPath = () => {
      const currentPath = window.location.pathname + window.location.search;
      
      // If user is accessing an admin dashboard route or shop route, remember it in localStorage
      if (currentPath.startsWith("/imeshadmindashbord") || currentPath.startsWith("/shop")) {
        localStorage.setItem("pwa_last_path", currentPath);
      }

      // Update PWA manifest link dynamically so PWA install action binds start_url to current URL
      const link = document.getElementById('manifest-link') || document.querySelector('link[rel="manifest"]');
      if (link && currentPath) {
        link.setAttribute('href', `/manifest.json?start_url=${encodeURIComponent(currentPath)}`);
      }
    };

    updateManifestAndPath();
    window.addEventListener('popstate', updateManifestAndPath);
    return () => window.removeEventListener('popstate', updateManifestAndPath);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="shopeefy-theme">
        <TooltipProvider>
          <Toaster />
          <AdminNotifier />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
