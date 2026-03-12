export const metadata = {
  title: '사무실 배치도',
  description: '우리 회사 좌석 배치 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
