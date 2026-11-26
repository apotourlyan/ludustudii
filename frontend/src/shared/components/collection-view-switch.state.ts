import { toggledCollectionView, type CollectionView } from "@/shared/lib/collection-view";

export interface CollectionViewSwitchProps {
  view: CollectionView;
  onChange: (view: CollectionView) => void;
}

// The view switch's value and its change: the view that is on is the one
// pressed, pressing the other one calls onChange with it, and pressing
// the one that is on does nothing, so one view is always shown. Returns
// what CollectionViewSwitchView renders.
export function useCollectionViewSwitch({ view, onChange }: CollectionViewSwitchProps) {
  function handleValueChange(pressed: readonly unknown[]) {
    const next = toggledCollectionView(pressed, view);
    if (next) {
      onChange(next);
    }
  }

  return {
    value: [view],
    onValueChange: handleValueChange,
  };
}

export type CollectionViewSwitchState = ReturnType<typeof useCollectionViewSwitch>;
