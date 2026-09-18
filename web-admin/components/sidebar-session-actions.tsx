export function SidebarSessionActions() {
  return (
    <div className="admin-sidebar-session-actions" aria-label="Account actions">
      <form action="/logout" method="post">
        <button className="admin-sidebar-session-link" type="submit">Change User</button>
      </form>
      <form action="/logout" method="post">
        <button className="admin-sidebar-session-link admin-sidebar-session-link-quiet" type="submit">Logout</button>
      </form>
    </div>
  );
}
