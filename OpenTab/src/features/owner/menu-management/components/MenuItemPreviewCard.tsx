// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
type MenuItemPreviewCardProps = {
  imageUrl: string;
  imageAlt: string;
  fallbackIcon: string;
  name: string;
  price: number;
  categoryName: string;
  description?: string;
};

export function MenuItemPreviewCard({
  imageUrl,
  imageAlt,
  fallbackIcon,
  name,
  price,
  categoryName,
  description,
}: MenuItemPreviewCardProps) {
  return (
    <div className="preview-card">
      <div className="preview-header">
        <div className="preview-image">
          {imageUrl ? <img src={imageUrl} alt={imageAlt} /> : <span>{fallbackIcon}</span>}
        </div>

        <div className="preview-info">
          <h4>{name}</h4>
          <div className="preview-meta-row">
            <span className="preview-price">{price || 0} RSD</span>
            <span className="preview-category">· {categoryName}</span>
          </div>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
