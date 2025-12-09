const ActivityFeed = ({ activities = [], variant = 'panel' }) => {
  const timeFormatter = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const renderEntries = () => {
    if (!activities.length) {
      return <p className="empty-state">No hay movimientos recientes.</p>
    }

    return (
      <div className="activity-feed-scroll" role="log" aria-live="polite">
        <ul className="activity-feed">
          {activities.map((event) => (
            <li key={event.id}>
              <p className="activity-title">{event.title}</p>
              <p className="activity-time">
                {event.createdAt ? timeFormatter.format(new Date(event.createdAt)) : ''}
              </p>
              <p className="activity-detail">{event.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (variant === 'modal') {
    return <div className="activity-feed-modal">{renderEntries()}</div>
  }

  return (
    <section className="panel" aria-label="Actividad reciente">
      <header className="panel-header">
        <div>
          <h2>Actividad reciente</h2>
          <p>Registros automáticos de cambios relevantes.</p>
        </div>
      </header>
      {renderEntries()}
    </section>
  )
}

export default ActivityFeed
