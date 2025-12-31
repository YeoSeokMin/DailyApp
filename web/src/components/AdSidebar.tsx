'use client';

import { useEffect, useState } from 'react';
import AdSlot from './AdSlot';
import { AdSlot as AdSlotType } from '@/types/ad';

interface AdSidebarProps {
  position: 'left' | 'right';
}

export default function AdSidebar({ position }: AdSidebarProps) {
  const [slots, setSlots] = useState<{ slot1: AdSlotType | null; slot2: AdSlotType | null }>({
    slot1: null,
    slot2: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await fetch('/api/ad/slots');
        const data = await res.json();

        if (data.success) {
          if (position === 'left') {
            setSlots({
              slot1: data.slots.left1,
              slot2: data.slots.left2
            });
          } else {
            setSlots({
              slot1: data.slots.right1,
              slot2: data.slots.right2
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch ad slots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [position]);

  if (loading) {
    return (
      <div className="hidden xl:flex flex-col gap-4 sticky top-24 self-start">
        <div className="w-[160px] h-[300px] bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        <div className="w-[160px] h-[300px] bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  const slotId1 = position === 'left' ? 'left1' : 'right1';
  const slotId2 = position === 'left' ? 'left2' : 'right2';

  return (
    <div className="hidden xl:flex flex-col gap-4 sticky top-24 self-start">
      <AdSlot
        slotId={slotId1}
        imageUrl={slots.slot1?.imageUrl || null}
        linkUrl={slots.slot1?.linkUrl || null}
        position={position}
      />
      <AdSlot
        slotId={slotId2}
        imageUrl={slots.slot2?.imageUrl || null}
        linkUrl={slots.slot2?.linkUrl || null}
        position={position}
      />
    </div>
  );
}
