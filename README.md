# 강사 찍사 대회 2026 상반기

GitHub Pages에 올릴 수 있는 정적 이벤트 앱입니다. 사진 저장과 실시간 갱신은 Supabase Storage와 Database를 사용합니다.

## 배포 전 설정

1. Supabase 프로젝트를 하나 만듭니다.
2. Supabase SQL Editor에서 `supabase.sql` 전체를 실행합니다.
3. Supabase Project Settings > API에서 Project URL과 anon public key를 복사합니다.
4. `config.js`의 `supabaseUrl`, `supabaseAnonKey`에 붙여 넣습니다.
5. GitHub Pages는 저장소 루트에서 배포하면 됩니다.

관리자 기본 코드는 `1234`입니다. 바꾸려면 Supabase SQL Editor에서 아래 쿼리를 실행합니다.

```sql
update public.photo_event_settings
set value = '새관리자코드'
where key = 'admin_code';
```

## 파일

- `index.html`: 업로드/관리자 화면
- `styles.css`: 화면 스타일
- `app.js`: Supabase 업로드, 실시간 목록, 별점/베스트 샷 관리
- `config.js`: Supabase 접속 설정
- `supabase.sql`: Supabase 테이블, 스토리지, 보안 정책, 관리자 함수
