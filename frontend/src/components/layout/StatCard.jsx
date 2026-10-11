const StatCard = ({ title, value, icon, trend, trendUp }) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
      <div className="flex items-center justify-between mb-2">
        {icon && (
          <span className="text-slate-400 group-hover:text-blue-500 transition-colors duration-200">
            {icon}
          </span>
        )}
        {trend !== undefined && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendUp
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {trendUp ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="text-3xl font-bold text-slate-800 mt-1.5">{value}</h2>
    </div>
  );
};

export default StatCard;