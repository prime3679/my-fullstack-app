'use client';

interface MenuFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCourse: string | null;
  onCourseChange: (course: string | null) => void;
  selectedDietary: string[];
  onDietaryChange: (tags: string[]) => void;
  availableCourses: string[];
}

export default function MenuFilters({
  searchQuery,
  onSearchChange,
  selectedCourse,
  onCourseChange,
  selectedDietary,
  onDietaryChange,
  availableCourses,
}: MenuFiltersProps) {
  const dietaryOptions = [
    'Vegetarian',
    'Vegan',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Low-Carb',
  ];

  const toggleDietary = (tag: string) => {
    if (selectedDietary.includes(tag)) {
      onDietaryChange(selectedDietary.filter((t) => t !== tag));
    } else {
      onDietaryChange([...selectedDietary, tag]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search menu items..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Course Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Course
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCourseChange(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCourse === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {availableCourses.map((course) => (
            <button
              key={course}
              onClick={() => onCourseChange(course)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCourse === course
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {course}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary Preferences */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Dietary Preferences
        </label>
        <div className="flex flex-wrap gap-2">
          {dietaryOptions.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleDietary(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedDietary.includes(tag)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
