import { useEffect, useRef } from "react";

export const useMutationObserver = (
  element: React.MutableRefObject<Element | undefined>,
  callback: MutationCallback,
  config?: MutationObserverInit
) => {
  const current = element?.current;
  const observer = useRef<MutationObserver>();

  useEffect(() => {
    // --- We are already observing old element
    if (observer?.current && current) {
      observer.current.disconnect();
    }
    observer.current = new MutationObserver(callback);
    observe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const observe = () => {
    if (element && element.current && observer.current) {
      observer.current.observe(element.current, config);
    }
  };
};
