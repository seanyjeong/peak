export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen text-white">
        {children}
      </body>
    </html>
  );
}
