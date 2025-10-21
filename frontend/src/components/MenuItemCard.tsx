'use client';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  course: string | null;
  allergens: string[];
  dietaryTags: string[];
  prepTimeMinutes: number | null;
}

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: () => void;
}

export default function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden border border-gray-200"
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
          <span className="text-lg font-bold text-green-600 ml-2">
            ${(item.price / 100).toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Dietary Tags */}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.dietaryTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {item.dietaryTags.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                +{item.dietaryTags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Allergens Warning */}
        {item.allergens && item.allergens.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
            <span className="font-medium">⚠️ Contains:</span>
            <span>{item.allergens.slice(0, 2).join(', ')}</span>
            {item.allergens.length > 2 && <span>+{item.allergens.length - 2}</span>}
          </div>
        )}

        {/* Prep Time */}
        {item.prepTimeMinutes && (
          <div className="text-xs text-gray-500">
            Prep time: ~{item.prepTimeMinutes} min
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-medium"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
