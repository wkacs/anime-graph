'use client'
import { useTranslations } from 'next-intl'
import TourSpotlight from '@/components/TourSpotlight'
import type { TourStep } from '@/lib/tour'

// A cimoldali tura sajat kliens-komponens, mert a lepesek szovege forditando,
// a gazda-oldal viszont ISR-elt szerver-komponens (ott nincs `useTranslations`).
export default function TitleTour() {
  const t = useTranslations('titleTour')
  const steps: TourStep[] = [
    { selector: 'fit', title: t('fitTitle'), text: t('fitText') },
    { selector: 'opinion', title: t('opinionTitle'), text: t('opinionText') },
  ]
  return <TourSpotlight page="title" steps={steps} />
}
