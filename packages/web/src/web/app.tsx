import { Redirect, Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { GuestOnly, Protected } from "./components/protected";
import { authClient } from "./lib/auth";
import { AgentFeedback } from "@runablehq/website-runtime";

import Landing from "./pages/landing";
import Prices from "./pages/prices";
import Terms from "./pages/terms";
import Dashboard from "./pages/index";
import Properties from "./pages/properties";
import PropertyForm from "./pages/property-form";
import PropertyDetail from "./pages/property-detail";
import Bookings from "./pages/bookings";
import Reports from "./pages/reports";
import ReportDetail from "./pages/report-detail";
import RoomDetail from "./pages/room-detail";
import ReportSign from "./pages/report-sign";
import ReportView from "./pages/report-view";
import SearchPage from "./pages/search";
import Account from "./pages/account";
import NewReport from "./pages/new-report";
import TenantReport from "./pages/tenant-report";
import MyBookings from "./pages/my-bookings";

function HomeRoute() {
  const session = authClient.useSession();
  if (session.isPending) return <Landing />;
  if (session.data?.user) {
    return (
      <Protected>
        <Dashboard />
      </Protected>
    );
  }
  return <Landing />;
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/t/:token">
          {(params) => <TenantReport token={params.token} />}
        </Route>
        {/* Public: people who booked follow a private emailed link. */}
        <Route path="/my-bookings/:token">{(params) => <MyBookings token={params.token} />}</Route>
        <Route path="/my-bookings">
          <MyBookings />
        </Route>
        {/* Spanish entry links (the language itself is picked up in lib/i18n). */}
        <Route path="/es">
          <Redirect to="/" replace />
        </Route>
        <Route path="/es/prices">
          <Redirect to="/prices" replace />
        </Route>
        <Route path="/es/terms">
          <Redirect to="/terms" replace />
        </Route>
        <Route path="/sign-in">
          <GuestOnly>
            <Landing />
          </GuestOnly>
        </Route>

        <Route path="/">
          <HomeRoute />
        </Route>

        <Route path="/properties">
          <Protected>
            <Properties />
          </Protected>
        </Route>

        <Route path="/properties/new">
          <Protected>
            <PropertyForm />
          </Protected>
        </Route>

        <Route path="/properties/:id/edit">
          {(params) => (
            <Protected>
              <PropertyForm id={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/properties/:id/inspect">
          {(params) => (
            <Protected>
              <NewReport propertyId={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/properties/:id">
          {(params) => (
            <Protected>
              <PropertyDetail id={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/prices">
          <Prices />
        </Route>

        <Route path="/terms">
          <Terms />
        </Route>

        <Route path="/bookings">
          <Protected>
            <Bookings />
          </Protected>
        </Route>

        <Route path="/reports">
          <Protected>
            <Reports />
          </Protected>
        </Route>

        <Route path="/reports/:id/view">
          {(params) => (
            <Protected>
              <ReportView id={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/reports/:id/sign">
          {(params) => (
            <Protected>
              <ReportSign id={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/reports/:id/rooms/:roomId">
          {(params) => (
            <Protected>
              <RoomDetail reportId={params.id!} roomId={params.roomId!} />
            </Protected>
          )}
        </Route>

        <Route path="/reports/:id">
          {(params) => (
            <Protected>
              <ReportDetail id={params.id} />
            </Protected>
          )}
        </Route>

        <Route path="/search">
          <Protected>
            <SearchPage />
          </Protected>
        </Route>

        <Route path="/account">
          <Protected>
            <Account />
          </Protected>
        </Route>

        <Route>
          <Protected>
            <Dashboard />
          </Protected>
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
