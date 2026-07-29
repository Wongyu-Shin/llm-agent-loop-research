import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>이 상태는 문서에 없습니다.</h1>
      <p>전체 지도로 돌아가 다음 전이를 선택하세요.</p>
      <Link href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        전체 지도
      </Link>
    </div>
  );
}
