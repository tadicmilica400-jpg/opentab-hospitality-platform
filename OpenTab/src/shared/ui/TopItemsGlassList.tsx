export type TopItemsGlassListItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
};

type TopItemsGlassListProps = {
  items: TopItemsGlassListItem[];
  emptyText?: string;
};

export function TopItemsGlassList({
  items,
  emptyText = "Nema stavki za prikaz.",
}: TopItemsGlassListProps) {
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);

  if (items.length === 0) {
    return (
      <div className="analytics-empty-state compact">
        <span>◌</span>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="top-items-list custom-scrollbar">
      {items.map((item, index) => {
        const share = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0;

        return (
          <div className="top-item-row" key={item.id}>
            <div className="top-item-rank">{index + 1}</div>

            <div className="top-item-main">
              <div className="top-item-title-row">
                <span>{item.name}</span>
                <small>{item.category}</small>
              </div>

              <div className="top-item-bar">
                <div
                  className="top-item-bar-fill"
                  style={{
                    width: `${Math.max(8, share)}%`,
                  }}
                />
              </div>
            </div>

            <div className="top-item-meta">
              <strong>{item.revenue.toLocaleString("sr-RS")} RSD</strong>
              <span>{item.quantity} kom.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}