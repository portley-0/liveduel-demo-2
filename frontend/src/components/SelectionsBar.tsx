import React from "react";
import { useFilter } from "@/context/FilterContext.tsx";
import { LuCircleX } from "react-icons/lu";

const SelectionsBar: React.FC = () => {
  const { defaultSelections, removeDefaultSelection } = useFilter();

  if (defaultSelections.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto whitespace-nowrap py-1 px-3 bg-darkblue">
      <div className="inline-flex space-x-2">
        {defaultSelections.map((selection) => (
          <div
            key={`${selection.type}-${selection.id}`}
            className="bg-greyblue text-white font-semibold rounded-lg px-3 py-1 flex items-center"
          >
            <span className="mr-2">{selection.name}</span>
            <button
              onClick={() => removeDefaultSelection(selection.id)}
              className="text-red-500 focus:outline-none"
              title="Remove selection"
            >
              <LuCircleX className="w-6 h-6" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectionsBar;
